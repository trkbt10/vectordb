/**
 * @file Small presentation helpers for DatabaseExplorer
 */

/**
 * Truncate a string to at most `n` characters, adding an ellipsis when truncated.
 *
 * @param s - The input string to shorten.
 * @param n - Maximum length including the ellipsis.
 * @returns The possibly truncated string.
 */
export function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Render a short preview of a vector as a string, printing up to `max` values.
 *
 * @param v - The vector to preview.
 * @param max - Maximum number of elements to include.
 * @returns A concise textual preview like "[0.123, 0.456, …]".
 */
export function vectorPreview(v: Float32Array, max = 3): string {
  if (!v || v.length === 0) {
    return "[]";
  }
  const parts = Array.from(v.slice(0, max)).map((x) => (Number.isFinite(x) ? (x as number).toFixed(3) : String(x)));
  return `[${parts.join(", ")}${v.length > max ? ", …" : ""}]`;
}
