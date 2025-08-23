/**
 * @file Config normalization + validation (raw -> AppConfig)
 */
import type { AppConfig, ServerOptions } from "./types";
import type { StorageConfig } from "../types";
import { isFileIO } from "../storage/guards";
import { builtinRegistry, createDataResolverFromRaw, createStorageFromRaw, toURL } from "./resolver_io";
import type { FileIO } from "../storage/types";
import { isObject } from "../util/is-object";

export type RawStorageConfig = { index: string; data: string | Record<string, string> };
export type MixedStorageConfig = {
  index: string | FileIO;
  data: string | Record<string, string> | FileIO | ((ns: string) => FileIO);
};

export type RawAppConfig = {
  name?: string;
  /** Explicit FileIOs are required */
  storage?: StorageConfig | RawStorageConfig | MixedStorageConfig;
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
  if (
    !isStorageConfigDirect(storageRaw) &&
    !isStorageConfigRaw(storageRaw) &&
    !isStorageConfigMixed(storageRaw)
  ) {
    throw new Error("storage must be FileIOs, URI strings, or a mix");
  }
}

/** Normalize raw config into runtime AppConfig and resolve IOs. */
export async function normalizeConfig(raw: unknown): Promise<AppConfig> {
  validateRawAppConfig(raw);
  const cfg = raw as { [k: string]: unknown };
  const resolvedName = typeof cfg.name === "string" ? cfg.name : undefined;
  const s = cfg.storage as StorageConfig | RawStorageConfig | MixedStorageConfig;
  const storage: StorageConfig = (() => {
    if (isStorageConfigDirect(s)) {
      return s;
    }
    if (isStorageConfigRaw(s)) {
      return createStorageFromRaw(s, builtinRegistry);
    }
    const mixed = s as MixedStorageConfig;
    const idx = resolveIndexAny(mixed.index);
    const data = resolveDataAny(mixed.data);
    return { index: idx, data };
  })();
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

function isStorageConfigRaw(x: unknown): x is RawStorageConfig {
  if (!x || typeof x !== "object") {
    return false;
  }
  const obj = x as { [k: string]: unknown };
  if (typeof obj.index !== "string") {
    return false;
  }
  const data = obj.data;
  if (typeof data === "string") {
    return true;
  }
  if (data && typeof data === "object") {
    for (const [, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v !== "string") {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isStorageConfigMixed(x: unknown): x is MixedStorageConfig {
  if (!x || typeof x !== "object") {
    return false;
  }
  const obj = x as { [k: string]: unknown };
  const idx = obj.index;
  const data = obj.data;
  const idxOk = typeof idx === "string" || isFileIO(idx);
  if (!idxOk) {
    return false;
  }
  if (typeof data === "string") {
    return true;
  }
  if (typeof data === "function") {
    return true;
  }
  if (isFileIO(data)) {
    return true;
  }
  return isObject(data);
}

function resolveIndexAny(x: string | FileIO): FileIO {
  if (isFileIO(x)) {
    return x as FileIO;
  }
  return resolveIndexFromString(x as string);
}

function resolveDataAny(x: string | Record<string, string> | FileIO | ((ns: string) => FileIO)) {
  if (typeof x === "function") {
    return x as (ns: string) => FileIO;
  }
  if (isFileIO(x)) {
    return x as FileIO;
  }
  return createDataResolverFromRaw(x as string | Record<string, string>, builtinRegistry);
}

function resolveIndexFromString(s: string): FileIO {
  const u = toURL(s);
  const scheme = u.protocol.replace(":", "");
  const prov = builtinRegistry[scheme];
  if (!prov?.indexFactory) {
    throw new Error(`No index resolver for scheme: ${u.protocol}`);
  }
  return prov.indexFactory(u);
}
