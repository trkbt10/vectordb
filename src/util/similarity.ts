import type { Metric } from '../types'
import { dotAt, l2negAt } from './math'

export type ScoreAtFn = (data: Float32Array, base: number, q: Float32Array, dim: number) => number

const SCORE_AT: Record<Metric, ScoreAtFn> = {
  cosine: dotAt,
  dot: dotAt,
  l2: l2negAt,
}

/**
 *
 */
export function getScoreAtFn(metric: Metric): ScoreAtFn {
  const fn = SCORE_AT[metric]
  if (!fn) {
    const keys = Object.keys(SCORE_AT).join(', ')
    throw new Error(`Unsupported metric: ${String(metric)}. Supported metrics: ${keys}`)
  }
  return fn
}
