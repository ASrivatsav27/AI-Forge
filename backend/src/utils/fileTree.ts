import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export type FileTree = {
  [key: string]: FileTree | null;
};

export async function generateFileTree(
  directory: string
): Promise<FileTree> {
  // Return an empty tree instead of throwing when the directory doesn't
  // exist. This prevents a 500 in getProjectDetails when a project's
  // stored workspacePath is stale (e.g. a Windows path opened on a
  // Dockerized Linux backend). An empty tree is safe on all platforms:
  // Windows direct gets here only if the workspace dir was never created,
  // which means there are no files to show anyway.
  if (!existsSync(directory)) {
    return {};
  }

  const tree: FileTree = {};

  async function buildTree(
    currentDir: string,
    currentTree: FileTree
  ): Promise<void> {
    let files: string[];

    try {
      files = await fs.readdir(currentDir);
    } catch {
      return;
    }

    for (const file of files) {
      // Ignore unnecessary folders
      if (file === "node_modules" || file === ".git") continue;

      const filePath = path.join(currentDir, file);

      try {
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          currentTree[file] = {};
          await buildTree(filePath, currentTree[file] as FileTree);
        } else {
          currentTree[file] = null;
        }
      } catch {
        continue;
      }
    }
  }

  await buildTree(directory, tree);

  return tree;
}
