/**
 * @file Config preset: in-memory storage via mem: URIs
 *
 * Usage:
 * import { defineConfig } from "vcdb/config";
 * import browserInMemory from "vcdb/presets/config/browser-inmemory";
 * export default defineConfig({ ...browserInMemory("mydb"), database: {...}, index: {...} });
 */
import type { RawAppConfig } from "../../config";

/**
 * Returns a config preset that stores both index and data in memory using `mem:` URIs.
 *
 * @param name Optional database name to include in the config.
 * @returns RawAppConfig configured to use in-memory storage.
 */
export default function preset(name?: string): RawAppConfig {
  return {
    ...(name ? { name } : {}),
    storage: { index: "mem:", data: "mem:" },
  } satisfies RawAppConfig;
}
