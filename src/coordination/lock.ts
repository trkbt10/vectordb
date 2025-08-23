/**
 * @file In-memory lease/lock primitives for single-writer coordination
 */

export type Lease = { epoch: number; until: number; holder?: string };

export type AcquireResult = { ok: true; epoch: number; until: number } | { ok: false };
export type RenewResult = { ok: true; until: number } | { ok: false };
export type ReleaseResult = { ok: true } | { ok: false };

import type { Clock } from "./clock";
import { systemClock } from "./clock";

export type LockProvider = {
  acquire(name: string, ttlMs: number, holder?: string): AcquireResult;
  renew(name: string, epoch: number, ttlMs: number, holder?: string): RenewResult;
  release(name: string, epoch: number, holder?: string): ReleaseResult;
};

/** In-memory lock provider (for tests and single-process setups). */
export function createMemoryLock(clock: Clock = systemClock): LockProvider {
  const leases = new Map<string, Lease>();
  const lastEpoch = new Map<string, number>();
  return {
    acquire(name, ttlMs, holder) {
      const now = clock.now();
      const ex = leases.get(name);
      const expired = !ex || ex.until <= now;
      if (expired) {
        const prev = lastEpoch.get(name) ?? 0;
        const nextEpoch = prev + 1;
        const lease: Lease = { epoch: nextEpoch, until: now + Math.max(1, ttlMs), holder };
        leases.set(name, lease);
        lastEpoch.set(name, nextEpoch);
        return { ok: true, epoch: lease.epoch, until: lease.until };
      }
      return { ok: false };
    },
    renew(name, epoch, ttlMs, holder) {
      const now = clock.now();
      const ex = leases.get(name);
      if (!ex || ex.epoch !== epoch || ex.until <= now) {
        return { ok: false };
      }
      const until = now + Math.max(1, ttlMs);
      leases.set(name, { epoch, until, holder: holder ?? ex.holder });
      return { ok: true, until };
    },
    release(name, epoch) {
      const ex = leases.get(name);
      if (!ex || ex.epoch !== epoch) {
        return { ok: false };
      }
      leases.delete(name);
      return { ok: true };
    },
  };
}
