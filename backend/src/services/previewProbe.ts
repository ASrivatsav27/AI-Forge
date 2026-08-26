import http from "http";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForPreview(
  port: string,
  timeout = 60000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      console.log(
        `[previewProbe] requesting http://localhost:${port}/`
      );

      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `http://localhost:${port}/`,
          (res) => {
            console.log(
              `[previewProbe] response status: ${res.statusCode}`
            );

            res.resume();

            resolve();
          }
        );

        req.on("error", (error) => {
          console.log(
            "[previewProbe] request error:",
            error
          );

          reject(error);
        });

        // Give the application enough time to perform
        // first-request compilation.
        req.setTimeout(15000, () => {
          console.log(
            "[previewProbe] request timeout after 15s"
          );

          req.destroy();
          reject(new Error("Request timeout"));
        });
      });

      console.log("[previewProbe] preview request succeeded");

      return true;
    } catch {
      await sleep(500);
    }
  }

  console.log(
    `[previewProbe] timed out after ${timeout}ms`
  );

  return false;
}