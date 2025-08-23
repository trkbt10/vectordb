/**
 * @file Specs: loadConfigModule (CJS/ESM/TS handling)
 */
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";

import { loadConfigModule } from "./loader";
import { DEFAULT_CONFIG_STEM } from "./resolve";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const base = path.resolve(".tmp");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, "spec-config-loader-"));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
}

describe("config/loader", () => {
  it("throws descriptive error when not found", async () =>
    withTempDir(async (dir) => {
      await expect(loadConfigModule(path.join(dir, DEFAULT_CONFIG_STEM))).rejects.toThrow(/Config not found/);
    }));

  it("loads default export from .mjs", async () =>
    withTempDir(async (dir) => {
      const file = path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`);
      const body = [
        "const storage = {",
        "  read: async () => new Uint8Array(),",
        "  write: async () => {},",
        "  append: async () => {},",
        "  atomicWrite: async () => {},",
        "};",
        "export default { name: 'ok', storage: { index: storage, data: storage } };",
        "",
      ].join(os.EOL);
      await writeFile(file, body, "utf8");
      const mod = await loadConfigModule(path.join(dir, DEFAULT_CONFIG_STEM));
      const x = mod as { name?: string; storage?: unknown };
      expect(x && x.name).toBe("ok");
    }));

  it("provides a helpful message when attempting to load TypeScript directly", async () =>
    withTempDir(async (dir) => {
      const file = path.join(dir, `${DEFAULT_CONFIG_STEM}.ts`);
      await writeFile(file, "export default {}\n", "utf8");
      await expect(loadConfigModule(path.join(dir, DEFAULT_CONFIG_STEM))).rejects.toThrow(/TypeScript config/);
    }));
});

