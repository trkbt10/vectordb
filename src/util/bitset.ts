/**
 * Tiny bitset using Uint8Array as boolean mask (0/1).
 *
 * Why: HNSW exploration needs fast inclusion checks for candidate masks
 * without performing id->index lookups on every step.
 */

export type BitMask = Uint8Array

export function createBitMask(n: number): BitMask { return new Uint8Array(n) }
export function maskSet(mask: BitMask, idx: number): void { if (idx >= 0 && idx < mask.length) mask[idx] = 1 }
export function maskHas(mask: BitMask, idx: number): boolean { return idx >= 0 && idx < mask.length && mask[idx] === 1 }
