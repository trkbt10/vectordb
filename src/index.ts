/**
 * @file Public entrypoint (single canonical import)
 * @remarks
 * This module is the only public entrypoint consumers should import from.
 * It aggregates the DB client and indexing/cluster APIs. Internals remain
 * organized under src/client/* and src/indexing/*.
 */

/**
 * Client API (in-memory VectorDB facade)
 * - VectorDB: lightweight client view over the core store/ANN
 * - create: allocate a new state and return a VectorDB
 * - from: wrap an existing state as a VectorDB (no copy)
 * @public
 */
export type { VectorDB } from "./client/types";
/**
 * Construction options for VectorDB (dimensions, metric, strategy, etc.)
 * @public
 */
export type { DatabaseOptions } from "./types";
/**
 * Search result types
 * @public
 */
export type { SearchHit } from "./types";
/**
 * Filter-expression types for VectorDB.find/findMany
 * @public
 */
export type { FilterExpr } from "./attr/filter/expr";
export type { SearchWithExprOptions } from "./attr/search/with_expr";
export type { FindOptions, FindManyOptions } from "./client/types";

/**
 * Cluster API (persistence + placement via CRUSH)
 * - createClient: bind IO adapters and expose db/index helpers
 * - ClientOptions: configure segmentation, shards, replicas, etc.
 * @public
 */
export type { ClientOptions } from "./client/index";
export { connect } from "./client/index";
// Re-export WAL helpers for convenience
export { createWalRuntime, encodeWal, decodeWal, applyWal, applyWalWithIndex } from "./wal/index";
export type { WalRuntime, WalRecord } from "./wal/index";
