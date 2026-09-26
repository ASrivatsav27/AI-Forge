import http from "http";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PreviewResult =
  | { ready: true }
  | { ready: false; reason: string };

/**
 * Probes the dev server until it responds 2xx or the timeout elapses.
 *
 * On a non-2xx response (e.g. Next.js's dev server returning 500 with
 * an HTML/JSON error overlay body), the response body is captured and
 * returned as `reason` — that body is where the actual compile/runtime
 * error text lives, and previously it was drained and discarded
 * (`res.resume()`), leaving callers with only a generic
 * "Preview HTTP verification timed out" message that gave the fix
 * agent nothing concrete to act on.
 *
 * PORTABILITY:
 * When the backend runs inside Docker, project container ports are
 * bound on the HOST network interface, not inside the backend
 * container. `localhost` inside the backend container refers to the
 * backend container itself, so probing `localhost:<hostPort>` always
 * fails with ECONNREFUSED.
 *
 * DOCKER_HOST_GATEWAY is set to `host.docker.internal` in
 * docker-compose.yml, which resolves to the host via Docker's
 * host-gateway mechanism on both Docker Desktop (Windows/Mac) and
 * Linux/EC2. When the backend runs directly on Windows without Docker,
 * the variable is not set and we fall back to `localhost`, preserving
 * the original behaviour.
 *
 * Environment   | DOCKER_HOST_GATEWAY | probeHost
 * ─────────────────────────────────────────────────
 * Windows direct| (not set)           | localhost
 * Windows Docker| host.docker.internal| host gateway
 * Linux/EC2 Docker| host.docker.internal| host gateway
 */
export async function waitForPreview(
  port: string,
  timeout = 60000
): Promise<PreviewResult> {
  const start = Date.now();
  let lastReason = "Preview did not become ready in time.";

  // Resolve once per waitForPreview call — the env var never changes
  // at runtime, so there is no need to read it inside the loop.
  const probeHost =
    process.env.DOCKER_HOST_GATEWAY ?? "localhost";

  while (Date.now() - start < timeout) {
    try {
      console.log(
        `[previewProbe] requesting http://${probeHost}:${port}/`
      );

      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `http://${probeHost}:${port}/`,
          (res) => {
            const statusCode = res.statusCode;

            console.log(
              `[previewProbe] response status: ${statusCode}`
            );

            if (
              statusCode !== undefined &&
              statusCode >= 200 &&
              statusCode < 300
            ) {
              // Success — consume and discard, we don't need the body.
              res.resume();
              resolve();
              return;
            }

            // Non-2xx: capture the body instead of discarding it.
            // This is where Next.js puts the actual compile error
            // (component name, line number, stack) in its dev
            // error overlay.
            let body = "";
            res.setEncoding("utf8");

            res.on("data", (chunk) => {
              body += chunk;
              // Cap how much we buffer — error overlays can be large
              // (embedded source maps etc.) and we only need enough
              // to identify the problem.
              if (body.length > 8000) {
                res.destroy();
              }
            });

            res.on("end", () => {
              reject(
                new Error(
                  `Preview returned HTTP status ${statusCode}. Response body:\n${body.slice(0, 4000)}`
                )
              );
            });

            res.on("close", () => {
              // Fired if we destroyed the stream above for being
              // too large, or the connection was cut mid-body.
              if (body.length > 0) {
                reject(
                  new Error(
                    `Preview returned HTTP status ${statusCode}. Response body (truncated):\n${body.slice(0, 4000)}`
                  )
                );
              }
            });
          }
        );

        req.on("error", (error) => {
          console.log(
            "[previewProbe] request error:",
            error
          );

          reject(error);
        });

        // Allow time for first-request compilation.
        req.setTimeout(15000, () => {
          console.log(
            "[previewProbe] request timeout after 15s"
          );

          req.destroy();

          reject(new Error("Request timeout"));
        });
      });

      console.log(
        "[previewProbe] preview request succeeded"
      );

      return { ready: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.log(
        "[previewProbe] preview check failed:",
        message
      );

      lastReason = message;

      await sleep(500);
    }
  }

  console.log(
    `[previewProbe] timed out after ${timeout}ms`
  );

  // Return the LAST real failure reason we saw (e.g. the actual 500
  // body), not a generic "timed out" string — that's what makes it
  // through to the fix agent as buildError, so it needs to be the
  // most informative thing we captured, not the least.
  return { ready: false, reason: `Timed out after ${timeout}ms. Last error: ${lastReason}` };
}
