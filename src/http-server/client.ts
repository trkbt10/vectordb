/**
 * @file Client construction from config
 */
import { connect, type VectorDB } from "../client";
import { createNodeFileIO } from "../storage/node";
import { createMemoryFileIO } from "../storage/memory";
import path from "node:path";
import type { AppConfig, MemoryStorageConfig, NodeStorageConfig } from "./types";
import { createWalRuntime } from "../wal/index";
import { createAsyncLock } from "../util/async_lock";

/** Create a client from an AppConfig (storage + DB + index). */
export async function createClientFromConfig(config: AppConfig): Promise<VectorDB<Record<string, unknown>>> {
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

  // WAL + lock + afterWrite policy based on config
  const lock = createAsyncLock();
  const walDir = config.server?.wal?.dir ?? ".vectordb/wal";
  const walIO = createNodeFileIO(walDir);
  const wal = createWalRuntime(walIO, `${name}.wal`);

  const state = {
    client: null as VectorDB<Record<string, unknown>> | null,
    opCount: 0,
    last: Date.now(),
  };
  const afterWrite = async (nOps: number) => {
    if (!state.client) {
      return;
    }
    state.opCount += nOps;
    const now = Date.now();
    const opsThreshold = Math.max(0, config.server?.autoSave?.ops ?? 0);
    const intervalMs = Math.max(0, config.server?.autoSave?.intervalMs ?? 0);
    const needOps = opsThreshold > 0 ? state.opCount >= opsThreshold : false;
    const needTime = intervalMs > 0 ? now - state.last >= intervalMs : false;
    if (needOps || needTime) {
      state.opCount = 0;
      state.last = now;
      await lock.runExclusive(async () => {
        await state.client!.index.saveState(state.client!.state, { baseName: name });
        await wal.truncate();
      });
    }
  };

  state.client = await connect({
    storage,
    database,
    index: { ...index, name },
    wal: { io: walIO, name: `${name}.wal` },
    lock,
    afterWrite,
  });
  // Best-effort replay at boot
  void wal.replayInto(state.client!.state);
  return state.client!;
}
