/**
 * @file Error-like type guards
 */

import { hasOwn } from "./is-object";

/** Narrow to real Error instances. */
export function isError(e: unknown): e is Error {
  return e instanceof Error;
}

/** Narrow to objects that expose a message field. */
export function hasErrorMessage(e: unknown): e is { message: unknown } {
  return hasOwn(e, "message");
}

/** Narrow to objects that expose a code field (e.g., Node ENOENT). */
export function hasErrorCode(e: unknown): e is { code: unknown } {
  return hasOwn(e, "code");
}
