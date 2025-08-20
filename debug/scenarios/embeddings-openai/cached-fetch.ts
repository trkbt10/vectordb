/**
 * @file Tiny cache wrapper around fetch for debug scenarios.
 */

import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

function stableStringify(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const rec = x as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ":" + stableStringify(rec[k]));
  return "{" + parts.join(",") + "}";
}

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function ensureDir(p: string) {
  await mkdir(p, { recursive: true });
}

/**
 * Cache-aware fetch that returns raw bytes.
 * - Namespaced directory under os.tmpdir(): vectorlite-cache/<namespace>/
 * - Key derived from method+url+body+keyHint (headers are ignored to avoid leaking secrets).
 * - Stored as <hash>.bin
 */
export async function cachedFetchBytes(
  namespace: string,
  url: string,
  init: RequestInit = {},
  keyHint?: string,
): Promise<Uint8Array> {
  const method = (init.method || "GET").toUpperCase();
  let bodyStr = "";
  if (init.body) {
    if (typeof init.body === "string") bodyStr = init.body;
    else if (init.body instanceof Uint8Array) bodyStr = Buffer.from(init.body).toString("base64");
    else if (typeof init.body === "object") bodyStr = stableStringify(init.body);
    else bodyStr = String(init.body);
  }
  const key = `v1|${method}|${url}|${bodyStr}|${keyHint ?? ""}`;
  const h = hashKey(key);
  const dir = path.join(os.tmpdir(), "vectorlite-cache", namespace);
  const file = path.join(dir, `${h}.bin`);

  try {
    const cached = await readFile(file);
    return new Uint8Array(cached);
  } catch {}

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetch failed ${res.status} ${res.statusText}: ${text}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  await ensureDir(dir);
  await writeFile(file, buf);
  return buf;
}

/** Convenience wrapper for JSON APIs. */
export async function cachedFetchJSON<T = unknown>(
  namespace: string,
  url: string,
  init: RequestInit = {},
  keyHint?: string,
): Promise<T> {
  const bytes = await cachedFetchBytes(namespace, url, init, keyHint);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}
/**
 * @file Tiny cache wrapper around fetch for debug scenarios.
 */
