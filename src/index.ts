/**
 * VectorLite public entry point.
 *
 * Why: Provide a single, documented surface for applications. Internals are
 * split into focused submodules (create/ops/serialize), but consumers can
 * import from here without worrying about internal layout.
 */

export type { VectorLiteState } from './vectorlite/state'
export type { VectorLiteOptions, HNSWParams, Metric } from './types'

export { createVectorLite } from './vectorlite/create'
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
} from './vectorlite/ops'
export { serialize, deserializeVectorLite } from './vectorlite/serialize'
export { searchWithExpr } from './search/with_expr'
export * from './wal'
export * from './persist/node'
export * from './persist/memory'
export * from './persist/opfs'
