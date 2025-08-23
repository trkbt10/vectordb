/**
 * @file Client construction from config
 */
import { connect, type VectorDB } from "../client";
import type { AppConfig } from "./types";
import { createAsyncLock } from "../util/async_lock";
import { systemClock } from "../coordination/clock";
// no unused types

/** Create a client from an AppConfig (storage + DB + index). */
export async function createClientFromConfig(config: AppConfig): Promise<VectorDB<Record<string, unknown>>> {
  const storage = config.storage;
  if (!storage) {
    throw new Error("config.storage is required and must be a concrete StorageConfig (FileIOs). No implicit resolution.");
  }
  const index = config.index;
  const database = config.database;
  const name = config.name;
  if (!name) {
    throw new Error("name is required");
  }

  // WAL + lock + afterWrite policy based on config
  const lock = createAsyncLock();

  // Inject coord defaults (clock/epsilon) into index ops
  const coordDefaults = { clock: config.server?.clock ?? systemClock, epsilonMs: Math.max(0, config.server?.epsilonMs ?? 0) };

  return await connect({
    storage,
    database,
    index: { ...(index ?? {}), name },
    lock,
    coordDefaultsForIndexing: coordDefaults,
  });
}
