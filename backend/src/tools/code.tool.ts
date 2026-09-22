// services/workspace-files.ts

import fs from "fs/promises";
import path from "path";

function resolveWorkspacePath(workspacePath: string,relativePath: string){
  const resolved = path.resolve(workspacePath, relativePath);
  const root = path.resolve(workspacePath);

  if (
    resolved !== root &&
    !resolved.startsWith(root + path.sep)
  ) {
    throw new Error("Path escapes workspace.");
  }

  return resolved;
}

export async function readWorkspaceFile(workspacePath: string,relativePath: string){
  const filePath = resolveWorkspacePath(
    workspacePath,
    relativePath,
  );

  return fs.readFile(filePath, "utf8");
}

export async function writeWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  content: string,
) {
  const filePath = resolveWorkspacePath(
    workspacePath,
    relativePath,
  );

  await fs.mkdir(path.dirname(filePath), {
    recursive: true,
  });

  await fs.writeFile(
    filePath,
    content,
    "utf8",
  );
}