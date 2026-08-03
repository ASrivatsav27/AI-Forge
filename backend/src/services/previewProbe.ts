import http from "http";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForPreview(
  port: string,
  timeout = 30000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          res.resume();
          resolve();
        });

        req.on("error", reject);

        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });

      return true;
    } catch {
      await sleep(500);
    }
  }

  return false;
}