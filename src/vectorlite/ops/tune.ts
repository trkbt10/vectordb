/**
 * HNSW parameter tuning (suggestions only, no auto-apply).
 *
 * Why: Evaluate recall/latency trade-offs across parameter grids in isolation
 * and surface ranked suggestions without mutating the active instance.
 */
import type { VectorLiteState } from '../state'
import { isHnswVL } from '../../util/guards'
import { search, buildHNSWFromStore, buildWithStrategy } from './core'

export type HnswTuneGrid = { efSearch?: number[]; M?: number[] }
export type HnswTuneResult = { params: { M: number; efSearch: number }; recall: number; latency: number }

export function tuneHnsw<TMeta>(vl: VectorLiteState<TMeta>, grid: HnswTuneGrid, queries: Float32Array[], k: number): HnswTuneResult[] {
  if (!isHnswVL(vl)) return []
  const efList = (grid.efSearch && grid.efSearch.length ? grid.efSearch : [vl.ann.efSearch]).map(x => Math.max(1, x|0))
  const MList = (grid.M && grid.M.length ? grid.M : [vl.ann.M]).map(x => Math.max(1, x|0))
  const bfTopK = (q: Float32Array, kk: number): Set<number> => new Set(search(buildWithStrategy(vl, 'bruteforce'), q, { k: kk }).map(h => h.id))
  const results: HnswTuneResult[] = []
  for (const M of MList) {
    const cand = (M === vl.ann.M) ? vl : buildHNSWFromStore(vl, { M, efConstruction: vl.ann.efConstruction, efSearch: vl.ann.efSearch })
    const origEf = (cand.strategy === 'hnsw') ? cand.ann.efSearch : 0
    for (const ef of efList) {
      if (cand.strategy === 'hnsw') cand.ann.efSearch = ef
      let sumR = 0
      let sumL = 0
      for (const q of queries) {
        const t0 = Date.now()
        const got = search(cand, q, { k })
        const dt = Date.now() - t0
        sumL += dt
        const truth = bfTopK(q, k)
        let inter = 0
        for (const h of got) if (truth.has(h.id)) inter++
        sumR += inter / k
      }
      if (cand.strategy === 'hnsw') cand.ann.efSearch = origEf
      results.push({ params: { M, efSearch: ef }, recall: sumR / Math.max(1, queries.length), latency: sumL / Math.max(1, queries.length) })
    }
  }
  results.sort((a,b)=> (b.recall - a.recall) || (a.latency - b.latency))
  return results
}
