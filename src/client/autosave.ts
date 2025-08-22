/**
 * @file Autosave policy helper for client
 */
import type { IndexOps } from "./indexing";
import type { VectorStoreState } from "../types";
import type { WalRuntime } from "../wal/index";
import type { AsyncLock } from "../util/async_lock";

export type AutoSaveOptions = { ops?: number; intervalMs?: number } | undefined;

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
  const policy = {
    opCount: 0,
    last: Date.now(),
    timer: null as ReturnType<typeof setInterval> | null,
  };
  const opsThreshold = Math.max(0, opts?.ops ?? 0);
  const intervalMs = Math.max(0, opts?.intervalMs ?? 0);

  const runSave = async () => {
    await lock.runExclusive(async () => {
      await indexOps.saveState(state, { baseName });
      await wal.truncate();
    });
  };

  const afterWrite = async (nOps: number) => {
    policy.opCount += nOps;
    const now = Date.now();
    const needOps = opsThreshold > 0 ? policy.opCount >= opsThreshold : false;
    const needTime = intervalMs > 0 ? now - policy.last >= intervalMs : false;
    if (needOps || needTime) {
      policy.opCount = 0;
      policy.last = now;
      await runSave();
    }
  };

  if (intervalMs > 0) {
    policy.timer = setInterval(async () => {
      if (policy.opCount > 0 && Date.now() - policy.last >= intervalMs) {
        policy.opCount = 0;
        policy.last = Date.now();
        await runSave();
      }
    }, intervalMs);
  }

  const dispose = () => {
    if (policy.timer) {
      clearInterval(policy.timer);
      policy.timer = null;
    }
  };

  return { afterWrite, dispose };
}
