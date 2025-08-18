/**
 * Minimal max-heap for { s: number } items.
 *
 * Why: HNSW search benefits from a priority queue for candidate selection.
 * This lightweight heap avoids repeated sorts, reducing overhead in tight loops.
 */

export type ScoreItem = { s: number }

export class MaxHeap<T extends ScoreItem> {
  private a: T[] = []
  get length() { return this.a.length }
  push(x: T) { this.a.push(x); this.up(this.a.length - 1) }
  pop(): T | undefined {
    const n = this.a.length
    if (n === 0) return undefined
    const top = this.a[0]
    const last = this.a.pop() as T
    if (n > 1) { this.a[0] = last; this.down(0) }
    return top
  }
  private up(i: number) {
    const a = this.a
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].s >= a[i].s) break
      const t = a[p]; a[p] = a[i]; a[i] = t
      i = p
    }
  }
  private down(i: number) {
    const a = this.a
    const n = a.length
    while (true) {
      let l = i * 2 + 1, r = l + 1, m = i
      if (l < n && a[l].s > a[m].s) m = l
      if (r < n && a[r].s > a[m].s) m = r
      if (m === i) break
      const t = a[m]; a[m] = a[i]; a[i] = t
      i = m
    }
  }
}
