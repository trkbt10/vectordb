/**
 * @file Top-K result collection utilities for efficient similarity search
 * 
 * This module provides optimized functions for maintaining collections of the
 * K best results during vector search operations. Key features:
 * - Efficient insertion sort for maintaining top-K results
 * - Avoids full array sorting by keeping results in sorted order
 * - Early termination when scores can't make it into top-K
 * - Generic implementation supporting any scored object type
 * 
 * These utilities are critical for search performance, as they minimize
 * the computational overhead of result collection in the inner loop of
 * similarity calculations, where millions of comparisons may occur.
 */

export type Scored = { s: number }

/**
 *
 */
export function pushTopK<T>(out: T[], hit: T, k: number, getScore: (t: T) => number): void {
  if (out.length < k) {
    out.push(hit)
    if (out.length === k) {
      out.sort((a, b) => getScore(b) - getScore(a))
    }
    return
  }
  if (getScore(hit) <= getScore(out[out.length - 1])) {
    return
  }
  out[out.length - 1] = hit
  for (let i = out.length - 1; i > 0 && getScore(out[i]) > getScore(out[i - 1]); i--) {
    const t = out[i]; out[i] = out[i - 1]; out[i - 1] = t
  }
}

/**
 *
 */
export function pushSortedDesc<T extends Scored>(arr: T[], item: T, limit?: number): void {
  let i = arr.length - 1
  arr.push(item)
  while (i >= 0 && arr[i].s < item.s) {
    arr[i + 1] = arr[i]
    i--
  }
  arr[i + 1] = item
  if (limit !== undefined && arr.length > limit) {
    arr.length = limit
  }
}
