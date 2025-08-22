/**
 * @file Core type definitions for the VectorDB system
 *
 * This module defines the fundamental types and interfaces used throughout the
 * VectorDB vector database. It includes:
 * - Metric types for similarity/distance calculations
 * - Configuration options for database initialization
 * - Search parameters and result types
 * - HNSW (Hierarchical Navigable Small World) graph parameters
 * - IVF (Inverted File) index parameters
 * - Common interfaces for vector operations
 *
 * These types form the public API contract for VectorDB, ensuring type safety
 * and consistency across all modules.
 */

/**
 * Distance/Similarity Metric.
 * - 'cosine': vectors are normalized internally, score in [-1,1]
 * - 'l2': score is negative squared distance (higher is closer)
 */
export type Metric = "cosine" | "l2" | "dot";

/** Controls add() behavior when id exists. */
export type UpsertOptions = {
  upsert?: boolean;
}; // default: false

/** Search arguments. */
export type SearchOptions<TMeta> = {
  k?: number; // default: 5
  filter?: (id: number, meta: TMeta | null) => boolean;
};

/** Search result: id + score (+ meta). */
export type SearchHit<TMeta> = {
  id: number;
  score: number; // cosine: higher is closer; l2: negative distance (higher is closer)
  meta: TMeta | null;
};

/** Result returned by get()/getOne(): vector and meta for an id. */
export type VectorRecord<TMeta> = {
  vector: Float32Array;
  meta: TMeta | null;
};

/** Input vector shape for writes (meta optional). */
export type VectorInput<TMeta> = {
  vector: Float32Array;
  meta?: TMeta | null;
};

/** Input row shape for writes (id + vector + optional meta). */
export type RowInput<TMeta> = { id: number } & VectorInput<TMeta>;

/** Public construction options. */
export type VectorDBOptions = {
  dim: number;
  metric?: Metric;
  capacity?: number;
  strategy?: "bruteforce" | "hnsw" | "ivf";
  hnsw?: HNSWParams;
  ivf?: IVFParams;
};
// Backward-compatible alias for external callers; prefer VectorDBOptions
export type VectorLiteOptions = VectorDBOptions;

/** HNSW algorithm parameters. */
export type HNSWParams = {
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  levelMult?: number;
  seed?: number;
  allowReplaceDeleted?: boolean;
};

export type IVFParams = {
  nlist?: number;
  nprobe?: number;
};

// ---------------------------------------------------------------------------
// VectorDB state types (moved from src/VectorDB/state.ts)

import type { BruteforceState } from "./ann/bruteforce";
import type { HNSWState } from "./ann/hnsw";
import type { IVFState } from "./ann/ivf";
import { CoreStore } from "./attr/store/store";

export type ANNs = BruteforceState | HNSWState | IVFState;

export type VectorStoreState<TMeta> = {
  dim: number;
  metric: Metric;
  store: CoreStore<TMeta>;
  strategy: "bruteforce" | "hnsw" | "ivf";
  ann: ANNs;
};
