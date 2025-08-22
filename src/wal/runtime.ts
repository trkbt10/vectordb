/**
 * @file WAL runtime using injected FileIO
 */
import type { FileIO } from "../storage/types";
import type { VectorStoreState } from "../types";
import { encodeWal, applyWal, type WalRecord } from "./format";

/** WAL runtime interface for append/replay/truncate. */
export type WalRuntime = {
  append(records: WalRecord[]): Promise<void>;
  replayInto<TMeta>(state: VectorStoreState<TMeta>): Promise<{ applied: number } | { applied: 0 }>;
  truncate(): Promise<void>;
};

/** Construct a WAL runtime bound to a FileIO and path. */
export function createWalRuntime(io: FileIO, walPath: string): WalRuntime {
  return {
    async append(records: WalRecord[]) {
      const bytes = encodeWal(records);
      await io.append(walPath, bytes);
    },
    async replayInto<TMeta>(state: VectorStoreState<TMeta>): Promise<{ applied: number } | { applied: 0 }> {
      try {
        const u8 = await io.read(walPath);
        applyWal(state, u8);
        return { applied: 1 };
      } catch {
        return { applied: 0 };
      }
    },
    async truncate() {
      await io.atomicWrite(walPath, new Uint8Array());
    },
  };
}
