/**
 * @file Node.js file system storage adapter for VectorDB
 */
import { readFile, rename, mkdir, rm, open } from "node:fs/promises";
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
      const fd = await open(full, "w");
      try {
        await fd.writeFile(toUint8(data));
        await fd.sync();
      } finally {
        await fd.close();
      }
    },
    async append(path: string, data) {
      const full = joinPath(baseDir, path);
      await ensureDir(full);
      const fd = await open(full, "a");
      try {
        await fd.writeFile(toUint8(data));
        await fd.sync();
      } finally {
        await fd.close();
      }
    },
    async atomicWrite(path: string, data) {
      const full = joinPath(baseDir, path);
      await ensureDir(full);
      const tmp = `${full}.tmp`;
      const fd = await open(tmp, "w");
      try {
        await fd.writeFile(toUint8(data));
        await fd.sync();
      } finally {
        await fd.close();
      }
      await rename(tmp, full);
      // Best-effort: sync parent directory to persist rename on some filesystems
      try {
        const dirFd = await open(dirname(full), "r");
        try {
          await dirFd.sync();
        } finally {
          await dirFd.close();
        }
      } catch {
        // ignore directory fsync errors
      }
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
