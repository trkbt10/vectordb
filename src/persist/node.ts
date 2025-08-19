/**
 * @file Node.js file system persistence adapter for VectorLite
 *
 * This module provides file I/O operations specifically for Node.js environments,
 * enabling VectorLite to persist vector databases to disk. It implements:
 *
 * - Snapshot persistence: Save and load complete database states
 * - Write-Ahead Logging (WAL): Append-only log for durability and crash recovery
 * - Atomic writes: Use temp file + rename pattern for safe updates
 * - FileIO interface: Consistent API that can be swapped with other adapters (e.g., OPFS)
 *
 * The module is used by VectorLite when running in Node.js to provide durable
 * storage capabilities, ensuring vector data survives process restarts and
 * enabling incremental updates through the WAL mechanism.
 */
import { writeFile, readFile, rename, mkdir, rm } from "node:fs/promises";
import { dirname, join as joinPath } from "node:path";
import type { FileIO } from "./types";
import { toUint8 } from "./types";

/**
 *
 */
export async function saveToFileNode(buf: ArrayBuffer, path: string) {
  await writeFile(path, new Uint8Array(buf));
}

/**
 *
 */
export async function loadFromFileNode(path: string): Promise<ArrayBuffer> {
  const u8 = await readFile(path);
  const out = new Uint8Array(u8.byteLength);
  out.set(u8);
  return out.buffer;
}

/** Append data to a file (WAL) via append flag. */
export async function appendToFileNode(buf: Uint8Array, path: string): Promise<void> {
  await writeFile(path, buf, { flag: "a" as unknown as undefined });
}

/** Atomic snapshot: write to temp file and rename over destination. */
export async function saveAtomicToFileNode(buf: ArrayBuffer, path: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, new Uint8Array(buf));
  await rename(tmp, path);
}

/**
 *
 */
export function createNodeFileIO(): FileIO {
  return {
    async read(path: string) {
      const u8 = await readFile(path);
      const out = new Uint8Array(u8.byteLength);
      out.set(u8);
      return out;
    },
    async write(path: string, data) {
      await writeFile(path, toUint8(data));
    },
    async append(path: string, data) {
      await writeFile(path, toUint8(data), { flag: "a" as unknown as undefined });
    },
    async atomicWrite(path: string, data) {
      const tmp = `${path}.tmp`;
      await writeFile(tmp, toUint8(data));
      await rename(tmp, path);
    },
    async del(path: string) {
      try {
        await rm(path, { force: true });
      } catch {}
    },
  };
}

/** Create a Node FileIO that prefixes all paths with baseDir and ensures directories exist. */
export function createPrefixedNodeFileIO(baseDir: string): FileIO {
  async function ensureDir(p: string) {
    await mkdir(dirname(p), { recursive: true });
  }
  return {
    async read(path: string) {
      const full = joinPath(baseDir, path);
      const u8 = await readFile(full);
      const out = new Uint8Array(u8.byteLength);
      out.set(u8);
      return out;
    },
    async write(path: string, data) {
      const full = joinPath(baseDir, path);
      await ensureDir(full);
      await writeFile(full, toUint8(data));
    },
    async append(path: string, data) {
      const full = joinPath(baseDir, path);
      await ensureDir(full);
      await writeFile(full, toUint8(data), { flag: "a" as unknown as undefined });
    },
    async atomicWrite(path: string, data) {
      const full = joinPath(baseDir, path);
      await ensureDir(full);
      const tmp = `${full}.tmp`;
      await writeFile(tmp, toUint8(data));
      await rename(tmp, full);
    },
    async del(path: string) {
      const full = joinPath(baseDir, path);
      try {
        await rm(full, { force: true });
      } catch {}
    },
  };
}
