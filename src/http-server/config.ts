/**
 * @file Config normalization: raw JSON -> runtime AppConfig (with FileIOs)
 */
import type { AppConfig, ServerOptions } from "./types";
import type { StorageConfig } from "../client/indexing";
import { builtinRegistry, createStorageFromRaw, type IORegistry, mergeRegistry } from "./io_resolver";

// Raw, JSON-friendly config for server: URI-based endpoints
// Examples:
// - file:.vectordb/index
// - file:/abs/path/index
// - mem:
export type RawStorage = { index: string; data: string | Record<string, string> };
export type RawAppConfig = {
  /** Canonical DB name */
  name?: string;
  storage?: RawStorage;
  database?: AppConfig["database"];
  /** Client options (no name here; use top-level name) */
  index?: AppConfig["index"];
  server?: Omit<ServerOptions, "wal">;
};

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

// WAL explicit configuration is intentionally unsupported: client binds WAL via index IO + `${name}.wal`.

/**
 * Normalize raw JSON-like config into AppConfig with concrete FileIOs.
 * - Validates structure and types without unsafe casts
 * - Resolves `storage.index` and `storage.data` URIs via IO registry
 */
export async function normalizeConfig(
  raw: unknown,
  resolvers?: { io?: IORegistry; baseDir?: string },
): Promise<AppConfig> {
  if (!raw || typeof raw !== "object") {
    throw new Error("config must be an object");
  }
  const cfg = raw as { [k: string]: unknown };
  const resolvedName = typeof cfg.name === "string" ? cfg.name : undefined;
  const storageRaw = cfg.storage as unknown;
  if (!storageRaw || typeof storageRaw !== "object") {
    throw new Error("config.storage is required");
  }
  if (!isRawStorageDecl(storageRaw)) {
    throw new Error("storage must declare { index, data } URIs");
  }

  const reg = mergeRegistry(builtinRegistry, resolvers?.io);
  const s = storageRaw as RawStorage;
  const storage: StorageConfig = createStorageFromRaw({ index: s.index, data: s.data }, reg);

  return {
    name: resolvedName,
    storage,
    database: (cfg.database as AppConfig["database"]) ?? undefined,
    index: { ...(cfg.index as AppConfig["index"] | undefined ?? {}) },
    server: { ...((cfg.server as AppConfig["server"]) ?? {}) },
  } satisfies AppConfig;
}
