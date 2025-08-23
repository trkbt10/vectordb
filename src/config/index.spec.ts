/**
 * @file Specs: public config API helpers
 */
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";

import { configPatternsLabel, defaultConfigPath, openClientFromConfig } from "./index";
import { DEFAULT_CONFIG_STEM } from "./resolve";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const base = path.resolve(".tmp");
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, "spec-config-index-"));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
}

describe("config/index helpers", () => {
  it("configPatternsLabel returns a concise label", () => {
    expect(configPatternsLabel()).toMatch(/^vectordb\.config\[/);
  });

  it("defaultConfigPath returns local stem path", () => {
    expect(defaultConfigPath()).toBe(`./${DEFAULT_CONFIG_STEM}`);
  });

  it("openClientFromConfig loads, normalizes, and opens a client", async () =>
    withTempDir(async (dir) => {
      const file = path.join(dir, `${DEFAULT_CONFIG_STEM}.mjs`);
      const body = [
        "const io = {",
        "  read: async () => { throw new Error('missing'); },",
        "  write: async () => {},",
        "  append: async () => {},",
        "  atomicWrite: async () => {},",
        "};",
        // Include database options to allow creation when state is missing
        "export default { name: 'demo', database: { dim: 3 }, storage: { index: io, data: io } };",
        "",
      ].join(os.EOL);
      await writeFile(file, body, "utf8");
      const client = await openClientFromConfig(path.join(dir, DEFAULT_CONFIG_STEM));
      expect(client).toBeTruthy();
      // Validate that returned client has essential API surface
      expect(typeof (client as { add?: unknown }).add).toBe("function");
      expect(typeof (client as { search?: unknown }).search).toBe("function");
    }));
});

