import type { HNSWState } from '../ann/hnsw'
import type { BruteforceState } from '../ann/bruteforce'
import type { VectorLiteState } from '../vectorlite/state'

export function isHnswState(x: BruteforceState | HNSWState): x is HNSWState {
  return (x as HNSWState)?.type === 'hnsw'
}

export function isBruteforceState(x: BruteforceState | HNSWState): x is BruteforceState {
  return (x as BruteforceState)?.type === 'bruteforce'
}

export function isHnswVL<TMeta>(vl: VectorLiteState<TMeta>): vl is VectorLiteState<TMeta> & { strategy: 'hnsw'; ann: HNSWState } {
  return vl.strategy === 'hnsw'
}

export function isBfVL<TMeta>(vl: VectorLiteState<TMeta>): vl is VectorLiteState<TMeta> & { strategy: 'bruteforce'; ann: BruteforceState } {
  return vl.strategy === 'bruteforce'
}
/**
 * Narrowing helpers for strategy/state discriminants.
 *
 * Why: Avoid unsafe casts by expressing intent via type guards that check
 * discriminant fields, keeping call sites explicit and safer.
 */
