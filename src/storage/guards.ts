/**
 * @file FileIO runtime guards
 */
import type { FileIO } from "./types";

/** Narrow unknown to FileIO by checking required methods. */
export function isFileIO(x: unknown): x is FileIO {
  if (!x || typeof x !== "object") {
    return false;
  }
  const obj = x as { [k: string]: unknown };
  if (typeof obj.read !== "function") {
    return false;
  }
  if (typeof obj.write !== "function") {
    return false;
  }
  if (typeof obj.append !== "function") {
    return false;
  }
  if (typeof obj.atomicWrite !== "function") {
    return false;
  }
  return true;
}
