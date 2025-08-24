/**
 * @file Specs: config discovery/load shared helpers
 */
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";

import { getConfigLoad } from "./index";
import { DEFAULT_CONFIG_STEM } from "./index";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const base = path.resolve(".tmp");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, "spec-config-"));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
}

async function resolveResource<T>(read: () => T): Promise<T> {
  for (;;) {
    try {
      return read();
    } catch (e) {
      if (e && typeof (e as unknown) === "object" && typeof (e as { then?: unknown }).then === "function") {
        await (e as Promise<unknown>);
        continue;
      }
      throw e;
    }
  }
}

describe("config discovery/load (shared)", () => {
  it("loads when *.mjs exists and ignores *.json", async () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, `${DEFAULT_CONFIG_STEM}.json`), JSON.stringify({ any: true }), "utf8");
      await writeFile(
        path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`),
        ["export default {", "  name: 'ok',", "  storage: { index: 'mem:', data: 'mem:' }", "};", ""].join(os.EOL),
        "utf8",
      );
      const loader = getConfigLoad(path.join(dir, DEFAULT_CONFIG_STEM));
      const found = await resolveResource(() => loader.resource.read());
      expect(found).toBe(path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`));
    }));

  it("returns null when only unsupported .json exists", async () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, `${DEFAULT_CONFIG_STEM}.json`), JSON.stringify({ any: true }), "utf8");
      const loader = getConfigLoad(path.join(dir, DEFAULT_CONFIG_STEM));
      const found = await resolveResource(() => loader.resource.read());
      expect(found).toBeNull();
    }));

  it("surfaces normalization error when storage is not resolvable", async () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`),
        ["export default {", "  name: 'bad',", "  storage: { index: 'mem:', data: { a: 1 } },", "};", ""].join(os.EOL),
        "utf8",
      );
      const loader = getConfigLoad(path.join(dir, DEFAULT_CONFIG_STEM));
      try {
        // read() should throw once normalized phase fails
        await resolveResource(() => loader.resource.read());
        throw new Error("expected error");
      } catch {
        const st = loader.getState();
        expect(st.error && st.error.length > 0).toBe(true);
      }
    }));
});
