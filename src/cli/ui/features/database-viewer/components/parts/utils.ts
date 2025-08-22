/**
 * @file Utils: helpers for meta inspection used by the table
 */

/** Check if a value is a JSON-serializable primitive. */
export function isPrimitive(v: unknown): boolean {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

/**
 * Check if an object is shallow (depth 1) with only primitive values.
 */
export function isShallowObject(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  for (const v of Object.values(o as Record<string, unknown>)) {
    if (!isPrimitive(v)) return false;
  }
  return true;
}
