/**
 * @file Similarity scoring functions for vector comparison
 *
 * This module provides the core similarity/distance functions used throughout
 * VectorDB for comparing vectors. It serves as a central registry that maps
 * metric types to their corresponding scoring functions:
 * - Cosine similarity: Measures angular similarity (normalized dot product)
 * - Dot product: Direct dot product for non-normalized comparisons
 * - L2 distance: Euclidean distance (returned as negative for consistency)
 *
 * The scoring functions are optimized for in-place computation on Float32Arrays,
 * avoiding allocations in the critical path of similarity search operations.
 */

import type { Metric } from "../types";
import { dotAt, l2negAt } from "./math";

export type ScoreAtFn = (data: Float32Array, base: number, q: Float32Array, dim: number) => number;

const SCORE_AT: Record<Metric, ScoreAtFn> = {
  cosine: dotAt,
  dot: dotAt,
  l2: l2negAt,
};

/**
 *
 */
export function getScoreAtFn(metric: Metric): ScoreAtFn {
  const fn = SCORE_AT[metric];
  if (!fn) {
    const keys = Object.keys(SCORE_AT).join(", ");
    throw new Error(`Unsupported metric: ${String(metric)}. Supported metrics: ${keys}`);
  }
  return fn;
}
