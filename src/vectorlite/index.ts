/**
 * @file VectorLite module aggregation and public API exports
 *
 * This module serves as the main entry point for VectorLite's operational APIs,
 * providing a carefully curated set of exports for users. It offers:
 * - Core operations (add, search, remove, update)
 * - Serialization/deserialization functions
 * - Maintenance and optimization utilities
 * - Bulk operations for efficient batch processing
 *
 * By centralizing exports here, we maintain a clean public API surface while
 * keeping internal modules properly encapsulated. This design enables better
 * tree-shaking and allows users to import only what they need.
 */
export type { VectorLiteState } from "../types";

export { createVectorLiteState } from "./create";

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
} from "./ops/core";
export { hnswCompactAndRebuild, compactStore, rebuildIndex } from "./ops/maintain";
export { upsertMany, removeMany } from "./ops/bulk";
export { stats, diagnose } from "./ops/stats";
export { checkConsistency, repairConsistency } from "./ops/consistency";
export { trainIvfCentroids, reassignIvfLists, evaluateIvf } from "./ops/ivf";
export { tuneHnsw } from "./ops/tune";
export { persistIndex, openFromIndex, rebuildFromData } from "./ops/index_persist";

export { searchWithExpr } from "../search/with_expr";
