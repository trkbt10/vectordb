/**
 * @file Open a database client from a config JSON path
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createNodeFileIO } from "../../../../../storage/node";
import { createMemoryFileIO } from "../../../../../storage/memory";
import { createOPFSFileIO } from "../../../../../storage/opfs";
import { connect } from "../../../../../index";
import type { ClientWithDatabase } from "../../../../../client/index";

type StorageKind = "node" | "memory" | "opfs";

/** Open a client from a configuration file path. */
export async function openFromConfig(pathToConfig: string): Promise<ClientWithDatabase<Record<string, unknown>>> {
  const raw = await readFile(path.resolve(pathToConfig), "utf8");
  type Cfg = {
    index?: { name?: string } & Record<string, unknown>;
    storage?: { type?: StorageKind; indexRoot?: string; dataRoot?: string };
    database?: { dim: number; metric: "cosine" | "l2" | "dot"; strategy: "bruteforce" | "hnsw" | "ivf" } & Record<string, unknown>;
  };
  const cfg: Cfg = JSON.parse(raw) as Cfg;
  const name = (cfg.index as { name?: string } | undefined)?.name;
  if (!name) throw new Error("index.name is required in config");
  const storageKind = cfg.storage?.type;
  if (!storageKind) throw new Error("storage.type is required in config (node|memory|opfs)");
  function resolveStorage(): { index: unknown; data: (key: string) => unknown } | { index: unknown; data: () => unknown } {
    if (storageKind === "memory") return { index: createMemoryFileIO(), data: () => createMemoryFileIO() };
    if (storageKind === "opfs") return { index: createOPFSFileIO(), data: () => createOPFSFileIO() };
    const idxRoot = cfg.storage?.indexRoot;
    const datRoot = cfg.storage?.dataRoot;
    if (!idxRoot) throw new Error("storage.indexRoot is required for node storage");
    if (!datRoot) throw new Error("storage.dataRoot is required for node storage");
    return { index: createNodeFileIO(idxRoot), data: (key: string) => createNodeFileIO(path.join(datRoot, key)) };
  }
  const storage = resolveStorage();
  const hasDb = Boolean(cfg.database);
  function resolveExtra(): { database: unknown } | { onMissing: () => Promise<never> } {
    if (hasDb) return { database: cfg.database } as const;
    return {
      onMissing: async () => {
        throw new Error("State missing and no database options provided in config");
      },
    } as const;
  }
  const extra = resolveExtra();
  return await connect<Record<string, unknown>>({ storage, index: { name, ...(cfg.index ?? {}) }, ...extra });
}
