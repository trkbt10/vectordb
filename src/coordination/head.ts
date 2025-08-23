/**
 * @file Head pointer and CAS helpers for manifest selection
 */

export type HeadEntry = { manifest: string; epoch: number; commitTs: number };

export type CasResult = { ok: true; head: HeadEntry } | { ok: false; reason: string };

/** CAS rules: epoch must not decrease; commitTs must increase. */
export function tryUpdateHead(current: HeadEntry | null, next: HeadEntry): CasResult {
  if (!current) {
    return { ok: true, head: next };
  }
  if (next.epoch < current.epoch) {
    return { ok: false, reason: "epoch_older" };
  }
  if (next.epoch === current.epoch && next.commitTs <= current.commitTs) {
    return { ok: false, reason: "ts_not_greater" };
  }
  return { ok: true, head: next };
}

/** Bounded staleness check: readable if commitTs <= readTs. */
export function isReadableAt(head: HeadEntry, readTs: number): boolean {
  return head.commitTs <= readTs;
}
