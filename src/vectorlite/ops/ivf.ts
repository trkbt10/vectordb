/**
 * @file IVF retraining and evaluation wrappers around ann/ivf.
 *
 * Why:
 * - Provide a thin, public VectorLite ops layer that delegates to `ann/ivf`.
 * - Centralize strategy-guarding: if `vl.strategy !== 'ivf'`, return safe no-op
 *   results rather than throwing, keeping call sites simple and consistent.
 * - Keep policy and orchestration (operator-triggered training/evaluation) out
 *   of core ANN routines for clearer layering and future cross-cutting hooks
 *   (logging/metrics/permissions) without touching ANN internals.
 */
import type { VectorLiteState } from '../state'
import { isIvfVL } from '../../util/guards'
import { ivf_trainCentroids, ivf_reassignLists, ivf_evaluate } from '../../ann/ivf'

/**
 * Train IVF centroids via k-means over the current store.
 * No-op if the current strategy is not IVF.
 */
export function trainIvfCentroids<TMeta>(vl: VectorLiteState<TMeta>, opts?: { iters?: number; seed?: number }): { updated: number } {
  if (!isIvfVL(vl)) return { updated: 0 }
  return ivf_trainCentroids(vl.ann, vl.store, opts ?? {})
}

/**
 * Reassign posting lists based on current centroids.
 * No-op if the current strategy is not IVF.
 */
export function reassignIvfLists<TMeta>(vl: VectorLiteState<TMeta>): { moved: number } {
  if (!isIvfVL(vl)) return { moved: 0 }
  return ivf_reassignLists(vl.ann, vl.store)
}

/**
 * Evaluate IVF recall/latency vs bruteforce for given queries.
 * Returns { recall: 0, latency: 0 } if strategy is not IVF.
 */
export function evaluateIvf<TMeta>(vl: VectorLiteState<TMeta>, queries: Float32Array[], k: number): { recall: number; latency: number } {
  if (!isIvfVL(vl)) return { recall: 0, latency: 0 }
  return ivf_evaluate(vl.ann, vl.store, queries, k)
}
