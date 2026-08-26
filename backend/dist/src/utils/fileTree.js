import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
export async function generateFileTree(directory) {
    if (!existsSync(directory)) {
        throw new Error(`Directory does not exist: ${directory}`);
    }
    const tree = {};
    async function buildTree(currentDir, currentTree) {
        let files;
        try {
            files = await fs.readdir(currentDir);
        }
        catch {
            return;
        }
        for (const file of files) {
            // Ignore unnecessary folders
            if (file === "node_modules" || file === ".git")
                continue;
            const filePath = path.join(currentDir, file);
            try {
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    currentTree[file] = {};
                    await buildTree(filePath, currentTree[file]);
                }
                else {
                    currentTree[file] = null;
                }
            }
            catch {
                continue;
            }
        }
    }
    await buildTree(directory, tree);
    return tree;
}
//# sourceMappingURL=fileTree.js.map