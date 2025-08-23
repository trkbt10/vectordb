/**
 * @file Head pointer IO helpers for index folder
 */
import type { IndexIOCtx } from "./types";
import { isObject } from "../util/is-object";
import { hasErrorCode, hasErrorMessage } from "../util/is-error";

export type HeadEntry = { manifest: string; epoch: number; commitTs: number };

function isHeadEntry(x: unknown): x is HeadEntry {
  if (!isObject(x)) {
    return false;
  }
  if (typeof x["manifest"] !== "string") {
    return false;
  }
  if (typeof x["epoch"] !== "number") {
    return false;
  }
  if (typeof x["commitTs"] !== "number") {
    return false;
  }
  return true;
}


function classifyMissing(e: unknown): boolean {
  // Node fs error: code === 'ENOENT'; Memory IO error: message includes 'file not found'
  const msg = hasErrorMessage(e) ? String((e as { message: unknown }).message) : String(e);
  const code = hasErrorCode(e) ? String((e as { code: unknown }).code) : undefined;
  return code === "ENOENT" || msg.toLowerCase().includes("file not found");
}

export type ReadHeadResult =
  | { ok: true; head: HeadEntry }
  | { ok: false; reason: "missing" | "invalid" | "io_error" };

/** Read HEAD with detailed error classification. */
export async function readHeadEx(baseName: string, opts: IndexIOCtx): Promise<ReadHeadResult> {
  async function inner(): Promise<ReadHeadResult> {
    try {
      const u8 = await opts.resolveIndexIO().read(`${baseName}.head.json`);
      const txt = new TextDecoder().decode(u8);
      try {
        const obj = JSON.parse(txt) as unknown;
        if (!isHeadEntry(obj)) {
          return { ok: false, reason: "invalid" };
        }
        return { ok: true, head: obj };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    } catch (e) {
      return { ok: false, reason: classifyMissing(e) ? "missing" : "io_error" };
    }
  }
  return inner();
}

/** Read HEAD entry from index folder; returns null if missing/invalid/IO error. */
export async function readHead(baseName: string, opts: IndexIOCtx): Promise<HeadEntry | null> {
  const res = await readHeadEx(baseName, opts);
  return res.ok ? res.head : null;
}

/** Atomically write HEAD entry into index folder. */
export async function writeHead(baseName: string, head: HeadEntry, opts: IndexIOCtx): Promise<void> {
  const u8 = new TextEncoder().encode(JSON.stringify(head));
  await opts.resolveIndexIO().atomicWrite(`${baseName}.head.json`, u8);
}
