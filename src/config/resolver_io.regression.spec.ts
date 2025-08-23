/**
 * @file Regression specs for resolver_io to prevent path/templating issues
 */
import path from "node:path";
import { mkdir, mkdtemp, rm, access } from "node:fs/promises";
import { constants as FS } from "node:fs";

import { toURL, createStorageFromRaw, builtinRegistry } from "./resolver_io";
import type { StorageConfig } from "../types";
import type { FileIO } from "../storage/types";

function getDataResolver(s: StorageConfig): (ns: string) => FileIO {
  if (typeof s.data === "function") {
    return s.data;
  }
  return () => s.data as FileIO;
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const base = path.resolve(".tmp");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, "spec-resolver-"));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
}

describe("resolver_io regressions", () => {
  it("toURL resolves bare paths relative to CWD (not filesystem root)", async () =>
    withTempDir(async (dir) => {
      const u = toURL(".vectordb/index");
      // Should resolve under the temp dir, absolute path
      expect(u.protocol).toBe("file:");
      expect(u.pathname).toBe(path.resolve(".vectordb/index"));
      // Ensure parent directory is within our temp dir
      expect(u.pathname.startsWith(dir)).toBe(true);
    }));

  it("{ns} data templates do not double-append namespace segments", async () =>
    withTempDir(async (dir) => {
      const raw = { index: path.join(dir, "idx"), data: path.join(dir, "data/{ns}") };
      const storage = createStorageFromRaw(raw, builtinRegistry);
      const dataIO = getDataResolver(storage)("db");
      await dataIO.write("foo", new Uint8Array([1, 2, 3]));
      const shouldExist = path.join(dir, "data", "db", "foo");
      const shouldNotExist = path.join(dir, "data", "db", "db", "foo");
      await expect(access(shouldExist, FS.F_OK)).resolves.toBeUndefined();
      await expect(access(shouldNotExist, FS.F_OK)).rejects.toBeDefined();
    }));

  it("supports mem: scheme for index and data (distinct resolvers per ns)", async () =>
    withTempDir(async () => {
      const storage = createStorageFromRaw({ index: "mem:", data: "mem:" }, builtinRegistry);
      const data = getDataResolver(storage);
      const d1 = data("alpha");
      const d2 = data("beta");
      expect(d1).not.toBe(d2);
      await d1.write("x", new Uint8Array([1]));
      const r = await d1.read("x");
      expect(Array.from(r)).toEqual([1]);
    }));

  it("file: absolute URIs respect CWD and {ns} without duplication", async () =>
    withTempDir(async (dir) => {
      const raw = { index: `file:${path.join(dir, "idx")}`, data: `file:${path.join(dir, "data/{ns}")}` };
      const storage = createStorageFromRaw(raw, builtinRegistry);
      const io = getDataResolver(storage)("db");
      await io.write("bar", new Uint8Array([9]));
      const shouldExist = path.join(dir, "data", "db", "bar");
      const shouldNotExist = path.join(dir, "data", "db", "db", "bar");
      await expect(access(shouldExist, FS.F_OK)).resolves.toBeUndefined();
      await expect(access(shouldNotExist, FS.F_OK)).rejects.toBeDefined();
    }));
});
