/**
 * @file Config preset: Node.js in-memory storage (mem: URIs)
 *
 * Usage:
 * import { defineConfig } from "vcdb/config";
 * import nodeMem from "vcdb/presets/config/node-inmemory";
 * export default defineConfig({ ...nodeMem("mydb"), database: {...}, index: {...} });
 */
import type { RawAppConfig } from "../../config/normalize";

/**
 * Returns a Node.js preset that stores both index and data in memory using `mem:` URIs.
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
