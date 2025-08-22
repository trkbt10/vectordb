/**
 * @file Client construction from config
 */
import { connect, type ClientWithDatabase } from "../client";
import { createNodeFileIO } from "../storage/node";
import { createMemoryFileIO } from "../storage/memory";
import path from "node:path";
import type { AppConfig, MemoryStorageConfig, NodeStorageConfig } from "./types";

/** Create a client from an AppConfig (storage + DB + index). */
export async function createClientFromConfig(config: AppConfig): Promise<ClientWithDatabase<Record<string, unknown>>> {
  const storage = (() => {
    if (!config.storage) {
      throw new Error("'storage' must be specified in config (node|memory). No implicit defaults.");
    }
    const s = config.storage as MemoryStorageConfig | NodeStorageConfig;
    if (s.type === "node") {
      const { indexRoot, dataRoot } = s as NodeStorageConfig;
      if (!indexRoot || !dataRoot) {
        throw new Error("storage.indexRoot and storage.dataRoot are required for node storage");
      }
      return { index: createNodeFileIO(indexRoot), data: (ns: string) => createNodeFileIO(path.join(dataRoot, ns)) };
    }
    if (s.type === "memory") {
      return { index: createMemoryFileIO(), data: () => createMemoryFileIO() };
    }
    throw new Error(`Unsupported storage.type: ${(s as { type?: unknown }).type}`);
  })();
  const index = config.index ?? {};
  const database = config.database;
  const name = config.name ?? index?.name ?? "db";
  return connect({ storage, database, index: { ...index, name } });
}
