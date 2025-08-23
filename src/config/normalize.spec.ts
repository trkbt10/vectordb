/**
 * @file Specs: normalize + validation for AppConfig
 */
import { createMemoryFileIO } from "../storage/memory";
import type { StorageConfig } from "../types";

import { defineConfig, normalizeConfig, validateRawAppConfig } from "./normalize";

describe("config/normalize", () => {
  it("defineConfig returns input for authoring ergonomics", () => {
    const cfg = defineConfig({ name: "a", storage: { index: createMemoryFileIO(), data: createMemoryFileIO() } });
    expect(cfg.name).toBe("a");
  });

  it("validateRawAppConfig enforces required storage shape", () => {
    expect(() => validateRawAppConfig(null)).toThrow(/config must be an object/);
    expect(() => validateRawAppConfig({})).toThrow(/config.storage is required/);
    expect(() => validateRawAppConfig({ storage: {} })).toThrow(/storage must be/i);
  });

  it("normalizeConfig keeps provided values and clones nested objects", async () => {
    const storage: StorageConfig = { index: createMemoryFileIO(), data: createMemoryFileIO() };
    const raw = {
      name: "n",
      storage,
      database: { dim: 3 },
      index: { shards: 2 },
      server: { port: 1234 },
    };
    const out = await normalizeConfig(raw);
    expect(out.name).toBe("n");
    expect(out.storage).toBe(storage);
    expect(out.database && out.database.dim).toBe(3);
    // shallow clone behavior: distinct refs but equal values for objects
    expect(out.index && out.index.shards).toBe(2);
    expect(out.server && out.server.port).toBe(1234);
  });
});
