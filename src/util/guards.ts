/**
 * @file Type guard utilities for runtime type discrimination
 *
 * This module provides type guard functions that enable safe runtime type checking
 * and narrowing for the various ANN (Approximate Nearest Neighbor) strategies.
 * These guards are essential for:
 * - Strategy-specific code paths that need to access specialized properties
 * - Safe type narrowing in TypeScript without type assertions
 * - Runtime validation of deserialized data structures
 *
 * The guards use discriminated unions (via the 'type' property) to provide
 * both runtime safety and compile-time type narrowing, allowing the TypeScript
 * compiler to understand which specific implementation is being used.
 */

import type { HNSWState } from "../ann/hnsw";
import type { BruteforceState } from "../ann/bruteforce";
import type { IVFState } from "../ann/ivf";
import type { VectorLiteState } from "../types";

/**
 *
 */
export function isHnswState(x: BruteforceState | HNSWState): x is HNSWState {
  return (x as HNSWState)?.type === "hnsw";
}

/**
 *
 */
export function isBruteforceState(x: BruteforceState | HNSWState): x is BruteforceState {
  return (x as BruteforceState)?.type === "bruteforce";
}

/**
 *
 */
export function isHnswVL<TMeta>(
  vl: VectorLiteState<TMeta>,
): vl is VectorLiteState<TMeta> & { strategy: "hnsw"; ann: HNSWState } {
  return vl.strategy === "hnsw";
}

/**
 *
 */
export function isBfVL<TMeta>(
  vl: VectorLiteState<TMeta>,
): vl is VectorLiteState<TMeta> & { strategy: "bruteforce"; ann: BruteforceState } {
  return vl.strategy === "bruteforce";
}

/**
 *
 */
export function isIvfVL<TMeta>(
  vl: VectorLiteState<TMeta>,
): vl is VectorLiteState<TMeta> & { strategy: "ivf"; ann: IVFState } {
  return vl.strategy === "ivf";
}
/**
 * Narrowing helpers for strategy/state discriminants.
 *
 * Why: Avoid unsafe casts by expressing intent via type guards that check
 * discriminant fields, keeping call sites explicit and safer.
 */
