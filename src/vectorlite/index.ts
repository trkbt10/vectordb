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
  hnswCompactAndRebuild,
  buildHNSWFromStore,
  buildIVFFromStore,
  upsertMany,
  removeMany,
  stats,
  diagnose,
  checkConsistency,
  repairConsistency,
  trainIvfCentroids,
  reassignIvfLists,
  evaluateIvf,
  compactStore,
  rebuildIndex,
  tuneHnsw,
} from './ops'

export { searchWithExpr } from '../search/with_expr'
