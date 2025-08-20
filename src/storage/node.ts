/**
 * @file Node.js file system storage adapter for VectorDB
 */
import { writeFile, readFile, rename, mkdir, rm } from "node:fs/promises";
import { dirname, join as joinPath } from "node:path";
import type { FileIO } from "./types";
import { toUint8 } from "./types";

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
