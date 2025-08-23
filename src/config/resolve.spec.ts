/**
 * @file Specs: resolveConfigPath behavior and constants
 */
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";

import { resolveConfigPath, CONFIG_EXTS, DEFAULT_CONFIG_STEM } from "./resolve";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const base = path.resolve(".tmp");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, "spec-config-resolve-"));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
}

describe("config/resolve", () => {
  it("returns null when nothing exists", async () =>
    withTempDir(async (dir) => {
      const p = await resolveConfigPath(path.join(dir, DEFAULT_CONFIG_STEM));
      expect(p).toBeNull();
    }));

  it("prefers explicit file when provided and exists", async () =>
    withTempDir(async (dir) => {
      const file = path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`);
      await writeFile(file, "export default {}\n", "utf8");
      const p = await resolveConfigPath(file);
      expect(p).toBe(file);
    }));

  it("scans extensions in order and finds the first match", async () =>
    withTempDir(async (dir) => {
      // create two candidates; resolver should pick the first in CONFIG_EXTS
      const ordered = [...CONFIG_EXTS];
      const first = path.join(dir, `${DEFAULT_CONFIG_STEM}${ordered[0]}`);
      const later = path.join(dir, `${DEFAULT_CONFIG_STEM}${ordered[ordered.length - 1]}`);
      await writeFile(later, "export default {}\n", "utf8");
      await writeFile(first, "export default {}\n", "utf8");
      const p = await resolveConfigPath(path.join(dir, DEFAULT_CONFIG_STEM));
      expect(p).toBe(first);
    }));

  it("checks nested stem inside a directory when base is a dir", async () =>
    withTempDir(async (dir) => {
      const nested = path.join(dir, "sub");
      await mkdir(nested, { recursive: true });
      const file = path.join(nested, `${DEFAULT_CONFIG_STEM}.mjs`);
      await writeFile(file, "export default {}\n", "utf8");
      const p = await resolveConfigPath(nested);
      expect(p).toBe(file);
    }));

  it("returns null for explicit missing file with extension", async () =>
    withTempDir(async (dir) => {
      const missing = path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`);
      const p = await resolveConfigPath(missing);
      expect(p).toBeNull();
    }));
});

