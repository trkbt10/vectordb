/**
 * @file Client preset: browser localStorage-backed storage
 *
 * Usage:
 * import browserLocal from "vcdb/presets/client/browser-localstorage";
 * const db = await connect({ ...browserLocal, database: { dim: 384 }, index: { name: "db" } });
 */
import { RawAppConfig } from "../../config";
import { createLocalStorageFileIO } from "../../storage/local_storage";

/**
 * Returns a config preset that uses browser localStorage (via FileIO adapter) for both index and data.
 *
 * @param name Optional database name to include in the config.
 * @returns RawAppConfig configured to use localStorage-backed FileIO.
 */
export default function preset(name?: string): RawAppConfig {
  const io = createLocalStorageFileIO();
  return {
    ...(name ? { name } : {}),
    storage: { index: io, data: io },
  } satisfies RawAppConfig;
}
