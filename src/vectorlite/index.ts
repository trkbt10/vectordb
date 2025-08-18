/**
 * VectorLite subpath entry: curated exports for operational APIs.
 *
 * Why: Provide a single import path for day-to-day usage while keeping
 * internal modules decoupled for clarity and testability.
 */
export type { VectorLiteState } from './state'

export { createVectorLite } from './create'
export { serialize, deserializeVectorLite } from './serialize'

export {
  size,
  has,
  add,
  addMany,
  getOne,
  get,
  getMeta,
  setMeta,
  remove,
  search,
  buildHNSWFromStore,
  buildIVFFromStore,
} from './ops/core'
export { hnswCompactAndRebuild, compactStore, rebuildIndex } from './ops/maintain'
export { upsertMany, removeMany } from './ops/bulk'
export { stats, diagnose } from './ops/stats'
export { checkConsistency, repairConsistency } from './ops/consistency'
export { trainIvfCentroids, reassignIvfLists, evaluateIvf } from './ops/ivf'
export { tuneHnsw } from './ops/tune'

export { searchWithExpr } from '../search/with_expr'
