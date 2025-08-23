/**
 * @file Commit timestamp calculation and commit-wait helpers
 */

export type CommitInputs = {
  prepareTs: number;
  lastCommittedTs: number;
  nowTs: number;
  delta: number;
};

/** Monotonic commit timestamp: max(prepare, last+delta, now). */
export function computeCommitTs(x: CommitInputs): number {
  const a = x.prepareTs;
  const b = x.lastCommittedTs + Math.max(0, x.delta);
  const c = x.nowTs;
  return Math.max(a, b, c);
}

/** Sleep utility (ms). */
export type Sleeper = (ms: number) => Promise<void>;

/**
 * Commit-wait until time has passed commitTs + epsilon.
 * Uses recursion to avoid while/let patterns per lint policy.
 */
export async function commitWait(
  commitTs: number,
  epsilonMs: number,
  now: () => number,
  sleep: Sleeper,
): Promise<void> {
  async function spin(): Promise<void> {
    if (now() <= commitTs + epsilonMs) {
      await sleep(1);
      return spin();
    }
  }
  await spin();
}
