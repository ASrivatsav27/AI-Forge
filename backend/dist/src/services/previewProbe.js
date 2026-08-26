import http from "http";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function waitForPreview(port, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            await new Promise((resolve, reject) => {
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
        }
        catch {
            await sleep(500);
        }
    }
    return false;
}
//# sourceMappingURL=previewProbe.js.map