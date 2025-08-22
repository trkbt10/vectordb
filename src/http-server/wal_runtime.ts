/**
 * @file WAL append/replay helpers for the server
 */
import fs from "node:fs/promises";
import path from "node:path";
import { encodeWal, applyWal, type WalRecord } from "../wal";
import type { VectorStoreState } from "../types";

export type WalOptions = {
  dir: string;
  name: string; // base name for wal file
};

/**
 * WAL file runtime helper.
 * - append(records) appends encoded records to wal file
 * - replayInto(state) replays wal into a given state (best effort)
 * - truncate() clears wal after successful snapshot
 */
export type WalRuntime = {
  ensureDir(): Promise<void>;
  append(records: WalRecord[]): Promise<void>;
  replayInto<TMeta>(state: VectorStoreState<TMeta>): Promise<{ applied: number } | { applied: 0 }>;
  truncate(): Promise<void>;
};

/** Create a WAL runtime instance with given options. */
export function create_wal_runtime(opts: WalOptions): WalRuntime {
  const file = path.resolve(opts.dir, `${opts.name}.wal`);
  return {
    async ensureDir() {
      await fs.mkdir(path.dirname(file), { recursive: true });
    },
    async append(records: WalRecord[]): Promise<void> {
      await this.ensureDir();
      const bytes = encodeWal(records);
      await fs.appendFile(file, bytes);
    },
    async replayInto<TMeta>(state: VectorStoreState<TMeta>): Promise<{ applied: number } | { applied: 0 }> {
      try {
        const u8 = new Uint8Array(await fs.readFile(file));
        applyWal(state, u8);
        return { applied: 1 };
      } catch {
        return { applied: 0 };
      }
    },
    async truncate(): Promise<void> {
      try {
        await fs.writeFile(file, new Uint8Array());
      } catch {
        // ignore
      }
    },
  };
}
