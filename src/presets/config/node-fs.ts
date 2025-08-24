/**
 * @file Config preset: Node.js filesystem storage
 *
 * Usage:
 * import { defineConfig } from "vcdb/config";
 * import nodeFs from "vcdb/presets/config/node-fs";
 * export default defineConfig({ ...nodeFs("./data/vcdb", "mydb"), database: {...}, index: {...} });
 */
import path from "node:path";
import type { RawAppConfig } from "../../config/normalize";

/**
 * Returns a config preset that stores index and data on the Node.js filesystem.
 *
 * @param baseDir Base directory path for persisted data; subfolders are created for index and data.
 * @param name Optional database name to include in the config.
 * @returns RawAppConfig configured to use filesystem paths.
 */
export default function preset(baseDir: string, name?: string): RawAppConfig {
  const abs = path.resolve(baseDir);
  return {
    ...(name ? { name } : {}),
    storage: {
      index: path.join(abs, "index"),
      data: path.join(abs, "data", "{ns}"),
    },
  } satisfies RawAppConfig;
}
