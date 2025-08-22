/**
 * @file Advanced vector search with filter expression support
 *
 * This module implements sophisticated vector search functionality that combines
 * similarity search with complex filtering capabilities. Key features include:
 * - Integration of filter expressions with vector similarity search
 * - Support for attribute-based pre-filtering using indexes
 * - HNSW-specific optimizations (hard/soft filtering modes, bridge budgets)
 * - Fallback to brute-force search for complex filter scenarios
 *
 * The module bridges the gap between pure vector similarity search and traditional
 * database queries, allowing users to find vectors that are both similar and match
 * specific criteria (metadata, attributes, ID ranges, etc.).
 */

import type { VectorStoreState } from "../../types";
import type { SearchHit } from "../../types";
import { normalizeQuery } from "../store/store";
import { compilePredicate, preselectCandidates, type FilterExpr } from "../filter/expr";
import type { AttrIndexReader, Scalar, Range } from "../filter/expr";
import { getScoreAtFn } from "../../util/similarity";
import { pushTopK } from "../../util/topk";
import { createBitMask, maskSet } from "../../util/bitset";
import { hnsw_search, HNSWState } from "../../ann/hnsw";
import { AttrIndex } from "..";

export type SearchWithExprOptions = {
  k?: number;
  index?: AttrIndex | null;
  hnsw?: {
    mode?: "none" | "hard" | "soft";
    bridgeBudget?: number;
    seeds?: "auto" | number;
    seedStrategy?: "random" | "topFreq";
    adaptiveEf?: { base: number; min: number; max: number };
    earlyStop?: { margin?: number };
  };
};

/**
 *
 */
export function searchWithExpr<TMeta>(
  vl: VectorStoreState<TMeta>,
  query: Float32Array,
  expr: FilterExpr,
  opts: SearchWithExprOptions = {},
): SearchHit<TMeta>[] {
  const k = Math.max(1, opts.k ?? 5);
  const q = normalizeQuery(vl.metric, query);
  const pred = compilePredicate(expr);
  const idx = opts.index ?? null;
  function makeIdxReader(x: AttrIndex | null | undefined): AttrIndexReader | null {
    if (!x) return null;
    return {
      eq: (key: string, value: Scalar) => x.eq(key, value),
      exists: (key: string) => x.exists(key),
      range: (key: string, r: Range) => x.range(key, r),
    };
  }
  const idxReader: AttrIndexReader | null = makeIdxReader(idx);
  const candidates = preselectCandidates(expr, idxReader);

  // HNSW hard-mode: score only candidates
  if (vl.strategy === "hnsw" && candidates && candidates.size > 0 && opts.hnsw?.mode === "hard") {
    const dim = vl.store.dim;
    if (q.length !== dim) throw new Error(`dim mismatch: got ${q.length}, want ${dim}`);
    const out: SearchHit<TMeta>[] = [];
    const data = vl.store.data;
    const scoreAt = getScoreAtFn(vl.metric);
    for (const id of candidates) {
      const at = vl.store.pos.get(id);
      if (at === undefined) continue;
      const meta = vl.store.metas[at];
      const attrs = idx ? idx.getAttrs(id) : null;
      if (!pred(id, meta, attrs)) continue;
      const base = at * dim;
      const s = scoreAt(data, base, q, dim);
      pushTopK(out, { id, score: s, meta }, k, (x) => x.score);
    }
    return out;
  }

  // HNSW soft-mode: pass candidate mask into search
  if (vl.strategy === "hnsw" && candidates && candidates.size > 0 && opts.hnsw?.mode === "soft") {
    const filter = (id: number, meta: TMeta | null) => {
      const attrs = idx ? idx.getAttrs(id) : null;
      return pred(id, meta, attrs);
    };
    const maskIdx = createBitMask(vl.store._count);
    for (const id of candidates) {
      const at = vl.store.pos.get(id);
      if (at !== undefined) maskSet(maskIdx, at);
    }
    return hnsw_search(vl.ann as HNSWState, vl.store, q, {
      k,
      filter,
      control: {
        mode: "soft",
        mask: candidates,
        maskIdx,
        bridgeBudget: opts.hnsw?.bridgeBudget ?? 32,
        seeds: opts.hnsw?.seeds ?? "auto",
        seedStrategy: opts.hnsw?.seedStrategy ?? "random",
        adaptiveEf: opts.hnsw?.adaptiveEf,
        earlyStop: opts.hnsw?.earlyStop,
      },
    });
  }

  // Bruteforce with candidate preselection
  if (vl.strategy === "bruteforce" && candidates && candidates.size > 0) {
    const dim = vl.store.dim;
    if (q.length !== dim) throw new Error(`dim mismatch: got ${q.length}, want ${dim}`);
    const out: SearchHit<TMeta>[] = [];
    const data = vl.store.data;
    const scoreAt = getScoreAtFn(vl.metric);
    for (const id of candidates) {
      const at = vl.store.pos.get(id);
      if (at === undefined) continue;
      const meta = vl.store.metas[at];
      const attrs = idx ? idx.getAttrs(id) : null;
      if (!pred(id, meta, attrs)) continue;
      const base = at * dim;
      const s = scoreAt(data, base, q, dim);
      pushTopK(out, { id, score: s, meta }, k, (x) => x.score);
    }
    return out;
  }

  // Fallback to built-in search with predicate filter
  const filter = (id: number, meta: TMeta | null) => {
    const attrs = idx ? idx.getAttrs(id) : null;
    return pred(id, meta, attrs);
  };
  // Call appropriate strategy directly
  if (vl.strategy === "hnsw") {
    return hnsw_search(vl.ann as HNSWState, vl.store, q, { k, filter });
  }
  // bruteforce path when no candidates
  const dim = vl.store.dim;
  if (q.length !== dim) throw new Error(`dim mismatch: got ${q.length}, want ${dim}`);
  const out: SearchHit<TMeta>[] = [];
  const data = vl.store.data;
  const scoreAt = getScoreAtFn(vl.metric);
  for (let i = 0; i < vl.store._count; i++) {
    const id = vl.store.ids[i];
    const meta = vl.store.metas[i];
    if (!filter(id, meta)) continue;
    const base = i * dim;
    const s = scoreAt(data, base, q, dim);
    pushTopK(out, { id, score: s, meta }, k, (x) => x.score);
  }
  return out;
}
