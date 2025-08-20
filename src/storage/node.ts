/**
 * @file Node.js file system storage adapter for VectorDB
 */
import { writeFile, readFile, rename, mkdir, rm } from "node:fs/promises";
import { dirname, join as joinPath } from "node:path";
import type { FileIO } from "./types";
import { toUint8 } from "./types";

/** Save bytes to a Node file. Why: simple snapshot writer. */
export async function saveToFileNode(buf: ArrayBuffer, path: string) {
  await writeFile(path, new Uint8Array(buf));
}

/** Load bytes from a Node file. Why: simple snapshot reader. */
export async function loadFromFileNode(path: string): Promise<ArrayBuffer> {
  const u8 = await readFile(path);
  const out = new Uint8Array(u8.byteLength);
  out.set(u8);
  return out.buffer;
}

/** Append bytes to a Node file (WAL). Why: durability for incremental updates. */
export async function appendToFileNode(buf: Uint8Array, path: string): Promise<void> {
  await writeFile(path, buf, { flag: "a" as unknown as undefined });
}

/** Atomic write via temp + rename. Why: crash-safe snapshot updates. */
export async function saveAtomicToFileNode(buf: ArrayBuffer, path: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, new Uint8Array(buf));
  await rename(tmp, path);
}

/** Raw Node FileIO without path prefixing. Why: plug into custom resolvers. */
export function createNodeRawFileIO(): FileIO {
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
      } catch {
        // Ignore errors - file may not exist
      }
    },
  };
}

/** Prefixed Node FileIO. Why: keep all artifacts under a base directory. */
export function createNodeFileIO(baseDir: string): FileIO {
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
      } catch {
        // Ignore errors - file may not exist
      }
    },
  };
}

export const createPrefixedNodeFileIO = createNodeFileIO;
