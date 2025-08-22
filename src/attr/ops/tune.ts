/**
 * @file Parameter tuning and optimization for VectorDB indices
 *
 * This module provides automated parameter tuning capabilities for optimizing
 * the recall/latency trade-offs in vector search indices. It performs grid
 * search across different parameter combinations, evaluates their performance
 * using provided query sets, and returns ranked suggestions without modifying
 * the active instance. This allows operators to make informed decisions about
 * parameter settings based on their specific workload characteristics.
 *
 * Capabilities:
 * - HNSW parameter tuning: M (connectivity) and efSearch grid search
 * - Recall measurement against brute-force ground truth
 * - Latency profiling for different parameter combinations
 * - Non-invasive testing: All evaluations on temporary instances
 * - Future: IVF nprobe tuning, metric-specific optimizations
 */

/**
 * HNSW parameter tuning (suggestions only, no auto-apply).
 *
 * Why: Evaluate recall/latency trade-offs across parameter grids in isolation
 * and surface ranked suggestions without mutating the active instance.
 */
import { HNSWState } from "../../ann/hnsw";
import { VectorStoreState } from "../../types";
import { isHnswVL } from "../../util/guards";
import { search, buildHNSWFromStore, buildWithStrategy } from "./core";

export type HnswTuneGrid = { efSearch?: number[]; M?: number[] };
export type HnswTuneResult = { params: { M: number; efSearch: number }; recall: number; latency: number };

/**
 *
 */
export function tuneHnsw<TMeta>(
  vl: VectorStoreState<TMeta>,
  grid: HnswTuneGrid,
  queries: Float32Array[],
  k: number,
): HnswTuneResult[] {
  if (!isHnswVL(vl)) return [];
  // vl is narrowed to HNSW here
  const efList = (grid.efSearch && grid.efSearch.length ? grid.efSearch : [vl.ann.efSearch]).map((x) =>
    Math.max(1, x | 0),
  );
  const MList = (grid.M && grid.M.length ? grid.M : [vl.ann.M]).map((x) => Math.max(1, x | 0));
  const bfTopK = (q: Float32Array, kk: number): Set<number> =>
    new Set(search(buildWithStrategy(vl, "bruteforce"), q, { k: kk }).map((h) => h.id));
  const results: HnswTuneResult[] = [];
  for (const M of MList) {
    // Build candidate HNSW state if M differs
    function candidateForM(m: number): VectorStoreState<TMeta> & { strategy: "hnsw"; ann: HNSWState } {
      if (m === vl.ann.M) return vl as VectorStoreState<TMeta> & { strategy: "hnsw"; ann: HNSWState };
      return buildHNSWFromStore(vl, {
        M: m,
        efConstruction: vl.ann.efConstruction,
        efSearch: vl.ann.efSearch,
      }) as VectorStoreState<TMeta> & { strategy: "hnsw"; ann: HNSWState };
    }
    const cand0 = candidateForM(M);
    // ensure cand is HNSW (buildHNSWFromStore returns HNSW)
    const cand = isHnswVL(cand0) ? cand0 : (vl as VectorStoreState<TMeta> & { strategy: "hnsw"; ann: HNSWState });
    const hnswCand = cand as VectorStoreState<TMeta> & { strategy: "hnsw"; ann: HNSWState };
    const origEf = hnswCand.ann.efSearch;
    for (const ef of efList) {
      hnswCand.ann.efSearch = ef;
      // eslint-disable-next-line no-restricted-syntax -- Performance: accumulating recall scores
      let sumR = 0;
      // eslint-disable-next-line no-restricted-syntax -- Performance: accumulating latency measurements
      let sumL = 0;
      for (const q of queries) {
        const t0 = Date.now();
        const got = search(hnswCand, q, { k });
        const dt = Date.now() - t0;
        sumL += dt;
        const truth = bfTopK(q, k);
        // eslint-disable-next-line no-restricted-syntax -- Performance: counting intersection for recall
        let inter = 0;
        for (const h of got) if (truth.has(h.id)) inter++;
        sumR += inter / k;
      }
      hnswCand.ann.efSearch = origEf;
      results.push({
        params: { M, efSearch: ef },
        recall: sumR / Math.max(1, queries.length),
        latency: sumL / Math.max(1, queries.length),
      });
    }
  }
  results.sort((a, b) => b.recall - a.recall || a.latency - b.latency);
  return results;
}
