/**
 * VectorLite state type (opaque to callers) and common imports.
 *
 * Why: Keep the core state shape in one place so we can split the
 * implementation into smaller, focused modules while re-exporting a
 * stable public API via the barrel file `src/vectorlite.ts`.
 */
import type { Metric } from '../types'
import type { CoreStore } from '../core/store'
import type { BruteforceState } from '../ann/bruteforce'
import type { HNSWState } from '../ann/hnsw'
import type { IVFState } from '../ann/ivf'

export type VectorLiteAnn = BruteforceState | HNSWState | IVFState

export type VectorLiteState<TMeta> = {
  dim: number
  metric: Metric
  store: CoreStore<TMeta>
  strategy: 'bruteforce' | 'hnsw' | 'ivf'
  ann: VectorLiteAnn
}
