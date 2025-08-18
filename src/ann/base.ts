import { Metric, SearchHit } from '../types'
import { CoreStore } from '../core/store'

export interface ANNStrategy<TMeta = unknown> {
  readonly type: 'bruteforce' | 'hnsw'
  readonly metric: Metric
  init(store: CoreStore<TMeta>): void
  add(id: number): void
  remove(id: number): void
  search(q: Float32Array, k: number, filter?: (id: number, meta: TMeta | null) => boolean): SearchHit<TMeta>[]
  serialize(): ArrayBuffer
  deserialize(buf: ArrayBuffer): void
}

