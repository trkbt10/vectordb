/**
 * @file Clock utilities for injectable current-time semantics
 */

export type Clock = { now(): number };

/** System clock backed by Date.now(). */
export const systemClock: Clock = { now: () => Date.now() };

/** Fixed clock for tests; always returns the same timestamp. */
export function fixedClock(ts: number): Clock {
  return { now: () => ts };
}

/** Offset clock for tests; returns Date.now() + offsetMs. */
export function offsetClock(offsetMs: number): Clock {
  return { now: () => Date.now() + offsetMs };
}
