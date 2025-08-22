/**
 * @file Efficient bit mask implementation for fast set operations
 *
 * This module provides a lightweight bit mask (bitset) implementation using Uint8Array
 * for memory-efficient boolean flags. It's specifically designed for:
 * - HNSW graph exploration where fast candidate inclusion checks are critical
 * - Pre-filtering operations where we need to mark valid/invalid indices
 * - Avoiding expensive ID-to-index lookups during search operations
 *
 * The implementation trades perfect space efficiency for simplicity and speed,
 * using one byte per flag instead of packing bits, which eliminates bit manipulation
 * overhead and provides better cache locality for sparse access patterns.
 */

export type BitMask = Uint8Array;

/**
 *
 */
export function createBitMask(n: number): BitMask {
  return new Uint8Array(n);
}
/**
 *
 */
export function maskSet(mask: BitMask, idx: number): void {
  if (idx < 0) {
    return;
  }
  if (idx >= mask.length) {
    return;
  }
  mask[idx] = 1;
}
/**
 *
 */
export function maskHas(mask: BitMask, idx: number): boolean {
  if (idx < 0) {
    return false;
  }
  if (idx >= mask.length) {
    return false;
  }
  return mask[idx] === 1;
}
