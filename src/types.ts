/**
 * @file Core type definitions for the VectorLite system
 * 
 * This module defines the fundamental types and interfaces used throughout the
 * VectorLite vector database. It includes:
 * - Metric types for similarity/distance calculations
 * - Configuration options for database initialization
 * - Search parameters and result types
 * - HNSW (Hierarchical Navigable Small World) graph parameters
 * - IVF (Inverted File) index parameters
 * - Common interfaces for vector operations
 * 
 * These types form the public API contract for VectorLite, ensuring type safety
 * and consistency across all modules.
 */

/**
 * Distance/Similarity Metric.
 * - 'cosine': vectors are normalized internally, score in [-1,1]
 * - 'l2': score is negative squared distance (higher is closer)
 */
export type Metric = "cosine" | "l2" | "dot";

/** Options for VectorLite construction. */
export type VectorLiteInit = {
  dim: number;
  metric?: Metric; // default: 'cosine'
  capacity?: number; // initial capacity; doubles on growth
}

/** Controls add() behavior when id exists. */
export type UpsertOptions = {
  upsert?: boolean;
} // default: false

/** Search arguments. */
export type SearchOptions<TMeta> = {
  k?: number; // default: 5
  filter?: (id: number, meta: TMeta | null) => boolean;
}

/** Search result: id + score (+ meta). */
export type SearchHit<TMeta> = {
  id: number;
  score: number; // cosine: higher is closer; l2: negative distance (higher is closer)
  meta: TMeta | null;
}

/** Public construction options. */
export type VectorLiteOptions = {
  dim: number;
  metric?: Metric;
  capacity?: number;
  strategy?: "bruteforce" | "hnsw" | "ivf";
  hnsw?: HNSWParams;
  ivf?: IVFParams;
}

/** HNSW algorithm parameters. */
export type HNSWParams = {
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  levelMult?: number;
  seed?: number;
  allowReplaceDeleted?: boolean;
}

export type IVFParams = {
  nlist?: number;
  nprobe?: number;
}

// ---------------------------------------------------------------------------
// VectorLite state types (moved from src/vectorlite/state.ts)

import type { CoreStore } from './core/store'
import type { BruteforceState } from './ann/bruteforce'
import type { HNSWState } from './ann/hnsw'
import type { IVFState } from './ann/ivf'

export type VectorLiteAnn = BruteforceState | HNSWState | IVFState

export type VectorLiteState<TMeta> = {
  dim: number
  metric: Metric
  store: CoreStore<TMeta>
  strategy: 'bruteforce' | 'hnsw' | 'ivf'
  ann: VectorLiteAnn
}
