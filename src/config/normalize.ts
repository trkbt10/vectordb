/**
 * @file Config normalization + validation (raw -> AppConfig)
 */
import type { AppConfig, ServerOptions } from "./types";
import type { StorageConfig } from "../types";
import { isFileIO } from "../storage/guards";

export type RawAppConfig = {
  name?: string;
  /** Explicit FileIOs are required */
  storage?: StorageConfig;
  database?: AppConfig["database"];
  index?: AppConfig["index"];
  server?: ServerOptions;
};

/** Authoring helper to get type inference in user configs. */
export function defineConfig(x: RawAppConfig): RawAppConfig {
  return x;
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
  if (!isStorageConfigDirect(storageRaw)) {
    throw new Error("storage must be explicit FileIOs (index + data)");
  }
}

/** Normalize raw config into runtime AppConfig and resolve IOs. */
export async function normalizeConfig(raw: unknown): Promise<AppConfig> {
  validateRawAppConfig(raw);
  const cfg = raw as { [k: string]: unknown };
  const resolvedName = typeof cfg.name === "string" ? cfg.name : undefined;
  const s = cfg.storage as StorageConfig;
  const storage: StorageConfig = s;
  return {
    name: resolvedName,
    storage,
    database: (cfg.database as AppConfig["database"]) ?? undefined,
    index: { ...((cfg.index as AppConfig["index"] | undefined) ?? {}) },
    server: { ...((cfg.server as AppConfig["server"]) ?? {}) },
  } satisfies AppConfig;
}

function isStorageConfigDirect(x: unknown): x is StorageConfig {
  if (!x || typeof x !== "object") {
    return false;
  }
  const obj = x as { [k: string]: unknown };
  const idx = obj["index"];
  const data = obj["data"];
  if (!isFileIO(idx)) {
    return false;
  }
  if (typeof data === "function") {
    return true;
  }
  return isFileIO(data);
}
