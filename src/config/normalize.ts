/**
 * @file Config normalization + validation (raw -> AppConfig)
 */
import type { AppConfig, ServerOptions, StorageConfig } from "./types";
import { builtinRegistry, createStorageFromRaw, type IORegistry, mergeRegistry } from "./resolver_io";

export type RawStorage = { index: string; data: string | Record<string, string> };
export type RawAppConfig = {
  name?: string;
  storage?: RawStorage;
  database?: AppConfig["database"];
  index?: AppConfig["index"];
  server?: Omit<ServerOptions, "wal">;
};

/** Authoring helper to get type inference in user configs. */
export function defineConfig(x: RawAppConfig): RawAppConfig {
  return x;
}

function isRawStorageDecl(x: unknown): x is RawStorage {
  if (typeof x !== "object" || x === null) {
    return false;
  }
  const obj = x as { [k: string]: unknown };
  const ix = obj["index"];
  const dt = obj["data"];
  if (typeof ix !== "string") {
    return false;
  }
  if (typeof dt === "string") {
    return true;
  }
  if (typeof dt !== "object" || dt === null) {
    return false;
  }
  for (const [, v] of Object.entries(dt)) {
    if (typeof v !== "string") {
      return false;
    }
  }
  return true;
}

/** Validate raw config shape. Throws with a descriptive message on invalid. */
/** Validate raw config shape and required properties. */
export function validateRawAppConfig(raw: unknown): void {
  if (!raw || typeof raw !== "object") {
    throw new Error("config must be an object (JS/TS module export)");
  }
  const cfg = raw as { [k: string]: unknown };
  const storageRaw = cfg.storage as unknown;
  if (!storageRaw || typeof storageRaw !== "object") {
    throw new Error("config.storage is required");
  }
  if (!isRawStorageDecl(storageRaw)) {
    throw new Error("storage must declare { index, data } URIs");
  }
}

/** Normalize raw config into runtime AppConfig and resolve IOs. */
export async function normalizeConfig(
  raw: unknown,
  resolvers?: { io?: IORegistry; baseDir?: string },
): Promise<AppConfig> {
  validateRawAppConfig(raw);
  const cfg = raw as { [k: string]: unknown };
  const resolvedName = typeof cfg.name === "string" ? cfg.name : undefined;
  const reg = mergeRegistry(builtinRegistry, resolvers?.io);
  const s = cfg.storage as RawStorage;
  const storage: StorageConfig = createStorageFromRaw({ index: s.index, data: s.data }, reg);
  return {
    name: resolvedName,
    storage,
    database: (cfg.database as AppConfig["database"]) ?? undefined,
    index: { ...((cfg.index as AppConfig["index"] | undefined) ?? {}) },
    server: { ...((cfg.server as AppConfig["server"]) ?? {}) },
  } satisfies AppConfig;
}
