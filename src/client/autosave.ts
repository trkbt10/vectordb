/**
 * @file Autosave policy helper for client
 */
import type { IndexOps } from "./indexing";
import type { VectorStoreState } from "../types";
import type { WalRuntime } from "../wal/index";
import type { AsyncLock } from "../util/async_lock";
import { createDebounced } from "../util/debounce";

export type AutoSaveOptions = { ops?: number; waitMs?: number; maxWaitMs?: number } | undefined;

/**
 * Create an autosave hook that persists the current state to index storage.
 * Triggers by op-count and/or elapsed interval; truncates WAL after save.
 */
export function createAutoSaveAfterWrite<TMeta>(
  indexOps: IndexOps<TMeta>,
  state: VectorStoreState<TMeta>,
  wal: WalRuntime,
  lock: AsyncLock,
  baseName: string,
  opts: AutoSaveOptions,
): { afterWrite: (nOps: number) => Promise<void>; dispose: () => void } {
  const policy = { opCount: 0 };
  const opsThreshold = Math.max(0, opts?.ops ?? 0);
  const waitMs = Math.max(0, opts?.waitMs ?? 0);
  const maxWait = Math.max(0, opts?.maxWaitMs ?? 0);

  const runSave = async () => {
    await lock.runExclusive(async () => {
      await indexOps.saveState(state, { baseName });
      await wal.truncate();
    });
  };

  const debounced = createDebounced(
    async () => {
      const hadOps = policy.opCount > 0;
      policy.opCount = 0;
      if (hadOps) {
        await runSave();
      }
    },
    waitMs,
    maxWait,
  );

  const afterWrite = async (nOps: number) => {
    policy.opCount += nOps;
    const needOps = opsThreshold > 0 ? policy.opCount >= opsThreshold : false;
    if (needOps) {
      await debounced.flush();
      return;
    }
    if (waitMs > 0 || maxWait > 0) {
      debounced.schedule();
    }
  };

  const dispose = () => {
    debounced.cancel();
    if (policy.opCount > 0) {
      void debounced.flush();
    }
  };

  return { afterWrite, dispose };
}
