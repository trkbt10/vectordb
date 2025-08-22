/**
 * @file Max-heap priority queue implementation for efficient candidate selection
 *
 * This module provides a specialized max-heap data structure optimized for
 * HNSW graph exploration and other priority-based algorithms. Key features:
 * - Generic implementation supporting any object with a numeric score
 * - O(log n) insertion and extraction of maximum elements
 * - Minimal memory allocations with in-place array operations
 * - Optimized for the hot path in nearest neighbor search
 *
 * The heap is essential for maintaining sorted candidates during graph
 * traversal, allowing efficient selection of the most promising nodes
 * without the overhead of repeated array sorting.
 */

export type ScoreItem = { s: number };

/**
 * Max heap implementation for efficient priority queue operations.
 * Class-based approach is justified here due to the stateful nature of the heap data structure.
 */
// eslint-disable-next-line no-restricted-syntax -- Heap data structure requires class for encapsulating state and operations
export class MaxHeap<T extends ScoreItem> {
  private a: T[] = [];
  get length() {
    return this.a.length;
  }
  push(x: T) {
    this.a.push(x);
    this.up(this.a.length - 1);
  }
  pop(): T | undefined {
    const n = this.a.length;
    if (n === 0) {
      return undefined;
    }
    const top = this.a[0];
    const last = this.a.pop() as T;
    if (n > 1) {
      this.a[0] = last;
      this.down(0);
    }
    return top;
  }
  private up(i: number) {
    const a = this.a;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].s >= a[i].s) {
        break;
      }
      const t = a[p];
      a[p] = a[i];
      a[i] = t;
      i = p;
    }
  }
  private down(i: number) {
    const a = this.a;
    const n = a.length;
    while (true) {
      const l = i * 2 + 1,
        r = l + 1;
      // eslint-disable-next-line no-restricted-syntax -- Performance-critical: heap operations require mutable index for finding max child
      let m = i;
      if (l < n && a[l].s > a[m].s) {
        m = l;
      }
      if (r < n && a[r].s > a[m].s) {
        m = r;
      }
      if (m === i) {
        break;
      }
      const t = a[m];
      a[m] = a[i];
      a[i] = t;
      i = m;
    }
  }
}
