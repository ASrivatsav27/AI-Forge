import fs from "fs/promises";
import path from "path";

const NEXT_CONFIG_CANDIDATES = ["next.config.ts", "next.config.mjs", "next.config.js"];

/**
 * Deterministically ensures allowedDevOrigins includes previewOrigin in
 * whichever next.config.* file exists in the workspace. No-op if none
 * exists yet (scaffold hasn't run) or the origin is already present.
 * Platform-owned — never delegated to an LLM, so correctness doesn't
 * depend on the agent remembering to do this or getting the edit right.
 */
export async function ensureNextAllowedDevOrigin(
  workspacePath: string,
  previewOrigin: string
): Promise<boolean> {
  for (const candidate of NEXT_CONFIG_CANDIDATES) {
    const filePath = path.join(workspacePath, candidate);

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue; // this candidate doesn't exist — try the next
    }

    if (content.includes(previewOrigin)) {
      return false; // already patched
    }

    const patched = mergeAllowedDevOrigins(content, previewOrigin);
    if (patched === content) {
      // Couldn't confidently parse the structure — leave it untouched.
      // The Setup Agent's system-prompt instruction remains as a fallback
      // for this edge case only.
      return false;
    }

    await fs.writeFile(filePath, patched, "utf8");
    return true;
  }

  return false; // no next.config.* exists yet
}

function mergeAllowedDevOrigins(source: string, origin: string): string {
  // allowedDevOrigins already present as an array — inject into it.
  const existingArray = source.match(/allowedDevOrigins\s*:\s*\[([^\]]*)\]/);
  if (existingArray) {
    const inner = existingArray[1]!.trim();
    const newInner = inner.length > 0
      ? `${inner.replace(/,\s*$/, "")}, "${origin}"`
      : `"${origin}"`;
    return source.replace(existingArray[0], `allowedDevOrigins: [${newInner}]`);
  }

  // No existing field — inject as the first property of the config
  // object literal. Matches `const nextConfig = {`, `const nextConfig:
  // NextConfig = {`, `export default {`, or `module.exports = {`.
  const objectOpen = source.match(
    /(const\s+\w+(?:\s*:\s*[\w.<>[\] ]+)?\s*=\s*\{|export\s+default\s*\{|module\.exports\s*=\s*\{)/
  );
  if (!objectOpen) return source; // leave untouched, don't risk corrupting it

  const insertAt = objectOpen.index! + objectOpen[0].length;
  return (
    source.slice(0, insertAt) +
    `\n  allowedDevOrigins: ["${origin}"],` +
    source.slice(insertAt)
  );
}
