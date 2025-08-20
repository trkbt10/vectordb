/**
 * @file Public entry for Yazawa (VectorDB)
 * @remarks
 * Exposes the stable, documented API surface for consumers. Internal or
 * advanced types should be imported from their specific submodules instead.
 */

/**
 * Client API (in-memory VectorDB facade)
 * - VectorDB: lightweight client view over the core store/ANN
 * - create: allocate a new state and return a VectorDB
 * - from: wrap an existing state as a VectorDB (no copy)
 * @public
 */
export type { VectorDB } from "./client/types";
export { create, fromState as from } from "./client/create";
/**
 * Construction options for VectorDB (dimensions, metric, strategy, etc.)
 * @public
 */
export type { VectorDBOptions } from "./types";
/**
 * Query types for VectorDB.search()/find()/findK()
 * @public
 */
export type { SearchOptions, SearchHit } from "./types";

/**
 * Cluster API (persistence + placement via CRUSH)
 * - createCluster: bind IO adapters and expose db/index helpers
 * - ClusterOptions: configure segmentation, shards, replicas, etc.
 * @public
 */
export type { ClusterOptions } from "./client/cluster";
export { createCluster } from "./client/cluster";
