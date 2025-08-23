/**
 * @file Small type guards for object-like values
 */

/** Narrow unknown to a generic object record (non-null). */
export function isObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object") {
    return false;
  }
  return value !== null;
}

/** Check that an object-like value has a given own property key. */
export function hasOwn<T extends string>(obj: unknown, key: T): obj is Record<T, unknown> {
  if (!isObject(obj)) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(obj, key);
}
