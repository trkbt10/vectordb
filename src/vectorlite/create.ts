/**
 * Construction utilities for VectorLite.
 *
 * Why: Separate creation from operations and (de)serialization so each module
 * remains focused and easier to reason about and test.
 */
import type { VectorLiteOptions } from '../types'
import type { Metric } from '../types'
import { createStore } from '../core/store'
import { createBruteforceState } from '../ann/bruteforce'
import { createHNSWState } from '../ann/hnsw'
import type { VectorLiteState } from './state'

export function createVectorLite<TMeta = unknown>(opts: VectorLiteOptions): VectorLiteState<TMeta> {
  const dim = opts.dim
  const metric: Metric = opts.metric ?? 'cosine'
  const store = createStore<TMeta>(dim, metric, opts.capacity ?? 1024)
  const strategy = (opts.strategy ?? 'bruteforce')
  const ann = strategy === 'hnsw' ? createHNSWState(opts.hnsw ?? {}, metric, store._capacity) : createBruteforceState(metric)
  return { dim, metric, store, strategy, ann }
}

