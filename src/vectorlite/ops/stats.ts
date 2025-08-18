/**
 * Stats and diagnose helpers.
 *
 * Why: Offer quick, read-only insights and suggestions without entangling
 * core operations, aiding observability and manual decision making.
 */
import type { VectorLiteState } from '../../types'
import { isHnswVL, isIvfVL } from '../../util/guards'
import { search } from './core'

export type HnswStats = { levels: number; avgDeg: number; tombstoneRatio?: number }
export type IvfStats = { nlist: number; nprobe: number; listSizeHist: number[] }
export type StatsOut = { n: number; dim: number; strategy: 'bruteforce'|'hnsw'|'ivf'; metric: 'cosine'|'l2'|'dot'; deletedRatio?: number; hnsw?: HnswStats; ivf?: IvfStats }

/**
 *
 */
export function stats<TMeta>(vl: VectorLiteState<TMeta>): StatsOut {
  const out: StatsOut = { n: vl.store._count, dim: vl.dim, strategy: vl.strategy, metric: vl.metric }
  if (isHnswVL(vl)) {
    const h = vl.ann
    const levels = Math.max(0, h.maxLevel)
    let edges = 0
    const nodes = vl.store._count
    for (let l = 0; l <= levels; l++) {
      const layer = h.links[l] || []
      for (let i = 0; i < layer.length; i++) edges += (layer[i]?.length || 0)
    }
    let dead = 0
    for (let i = 0; i < nodes; i++) if (h.tombstone[i] === 1) dead++
    const tomb = nodes ? (dead / nodes) : 0
    out.hnsw = { levels, avgDeg: nodes ? (edges / Math.max(1, nodes)) : 0, tombstoneRatio: tomb }
    out.deletedRatio = tomb
  } else if (isIvfVL(vl)) {
    const lists = vl.ann.lists
    const sizes = lists.map(a => a.length)
    out.ivf = { nlist: vl.ann.nlist, nprobe: vl.ann.nprobe, listSizeHist: sizes }
    out.deletedRatio = 0
  }
  return out
}

/**
 *
 */
export function diagnose<TMeta>(vl: VectorLiteState<TMeta>, opts?: { sampleQueries?: Float32Array[]; k?: number }): { stats: StatsOut; suggestions: string[]; recallEstimate?: number; hotspots?: string[] } {
  const s = stats(vl)
  const suggestions: string[] = []
  const hotspots: string[] = []
  if (vl.strategy === 'bruteforce' && s.n >= 10000) suggestions.push('Large dataset on BF; consider HNSW/IVF for latency. (manual build)')
  if (isHnswVL(vl)) {
    if ((s.hnsw?.avgDeg ?? 0) < 4) suggestions.push('HNSW avgDeg is low; consider increasing M or efConstruction.')
    if ((s.hnsw?.tombstoneRatio ?? 0) > 0.3) suggestions.push('HNSW tombstone high; consider compaction.')
  }
  if (isIvfVL(vl)) {
    const arr: number[] = s.ivf ? s.ivf.listSizeHist : []
    const avg = arr.reduce((x:number,y:number)=>x+y,0)/Math.max(1,arr.length)
    if (arr.some(x => x > 2*avg)) {
      suggestions.push('IVF list imbalance detected; consider retraining centroids (k-means).')
      const maxIdx = arr.reduce((bi, v, i, a) => v > a[bi] ? i : bi, 0)
      hotspots.push(`ivf.list[${maxIdx}] size=${arr[maxIdx]}`)
    }
  }
  let recallEstimate: number | undefined
  const qs = opts?.sampleQueries
  if (qs && qs.length > 0) {
    const k = Math.max(1, opts?.k ?? 5)
    let acc = 0
    for (const q of qs) {
      const bf = search(vl, q, { k, filter: undefined })
      const res = search(vl, q, { k, filter: undefined })
      const truth = new Set(bf.map(h => h.id))
      let inter = 0
      for (const h of res) if (truth.has(h.id)) inter++
      acc += inter / k
    }
    recallEstimate = acc / qs.length
  }
  return { stats: s, suggestions, recallEstimate, hotspots: hotspots.length ? hotspots : undefined }
}
