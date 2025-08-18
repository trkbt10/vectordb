/**
 * IVF retraining and evaluation wrappers around ann/ivf.
 *
 * Why: Expose explicit, operator-triggered training and assessment flows
 * for IVF without embedding policy into core search routines.
 */
import type { VectorLiteState } from '../state'
import { isIvfVL } from '../../util/guards'
import { ivf_trainCentroids, ivf_reassignLists, ivf_evaluate } from '../../ann/ivf'

export function trainIvfCentroids<TMeta>(vl: VectorLiteState<TMeta>, opts?: { iters?: number; seed?: number }): { updated: number } {
  if (!isIvfVL(vl)) return { updated: 0 }
  return ivf_trainCentroids(vl.ann, vl.store, opts ?? {})
}

export function reassignIvfLists<TMeta>(vl: VectorLiteState<TMeta>): { moved: number } {
  if (!isIvfVL(vl)) return { moved: 0 }
  return ivf_reassignLists(vl.ann, vl.store)
}

export function evaluateIvf<TMeta>(vl: VectorLiteState<TMeta>, queries: Float32Array[], k: number): { recall: number; latency: number } {
  if (!isIvfVL(vl)) return { recall: 0, latency: 0 }
  return ivf_evaluate(vl.ann, vl.store, queries, k)
}
