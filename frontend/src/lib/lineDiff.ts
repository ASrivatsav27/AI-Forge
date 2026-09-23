/**
 * Minimal line-level diff. Returns the 1-indexed line numbers in
 * `newText` that are new or changed relative to `oldText`.
 *
 * Classic LCS-based diff — fine for typical source files. Skips
 * the computation entirely above a size threshold to avoid an
 * O(n*m) blowup on huge files.
 */
export function diffAddedLines(oldText: string, newText: string): number[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const n = oldLines.length;
  const m = newLines.length;

  if (n * m > 4_000_000) {
    // Too large to diff cheaply — treat the whole new file as "added".
    return Array.from({ length: m }, (_, i) => i + 1);
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const added: number[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++; // line removed from old — no counterpart in new
    } else {
      added.push(j + 1); // 1-indexed
      j++;
    }
  }

  while (j < m) {
    added.push(j + 1);
    j++;
  }

  return added;
}
