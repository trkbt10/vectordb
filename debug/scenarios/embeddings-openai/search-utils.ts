/**
 * @file Search and evaluation utilities
 */

import type { AttrIndex } from "../../../src/attr/index";
import { compilePredicate } from "../../../src/attr/filter/expr";
import type { FilterExpr } from "../../../src/attr/filter/expr";
import type { VLiteClient } from "../../../src/index";
import type { EvalItem } from "./types";

export function runSearch<TMeta>(
  vl: VLiteClient<TMeta>,
  idx: AttrIndex | null,
  strategy: "bruteforce" | "hnsw" | "ivf",
  q: Float32Array,
  expr?: FilterExpr,
  opts?: { hnswFilterMode?: "soft" | "hard"; hnswSeeds?: "auto" | number; hnswBridge?: number },
) {
  const searchOpts: Parameters<typeof vl.search>[1] = { k: 5 };
  if (expr) {
    const pred = compilePredicate(expr);
    searchOpts.filter = (id, meta) => pred(id, meta, idx ? idx.getAttrs(id) : undefined);
  }
  return vl.search(q, searchOpts);
}

export function evaluateRecall<TMeta>(
  dbBF: VLiteClient<TMeta>,
  dbHNSW: VLiteClient<TMeta>,
  dbIVF: VLiteClient<TMeta>,
  queries: string[],
  embeddings: Float32Array[],
): EvalItem[] {
  const evalOut: EvalItem[] = [];
  const k = 5;

  queries.forEach((q, idx) => {
    const base = embeddings[idx];
    const bf = dbBF.search(base, { k });
    const hs = dbHNSW.search(base, { k });
    const iv = dbIVF.search(base, { k });
    const bfIds = bf.map((x) => x.id);
    const hnswIds = hs.map((x) => x.id);
    const ivfIds = iv.map((x) => x.id);
    const bfSet = new Set(bfIds);
    const hsSet = new Set(hnswIds);
    const ivfSet = new Set(ivfIds);
    const inter = bfIds.filter((id) => hsSet.has(id));
    const missing = bfIds.filter((id) => !hsSet.has(id));
    const extra = hnswIds.filter((id) => !bfSet.has(id));
    const rNum = inter.length / k;
    const recall = `${inter.length}/${k} (${rNum.toFixed(2)})`;
    const interI = bfIds.filter((id) => ivfSet.has(id));
    const rINum = interI.length / k;
    const ivfRecall = `${interI.length}/${k} (${rINum.toFixed(2)})`;
    evalOut.push({
      q,
      recall,
      recallNum: rNum,
      ivfRecall,
      ivfRecallNum: rINum,
      bfIds,
      hnswIds,
      ivfIds,
      missing,
      extra,
    });
  });

  return evalOut;
}

export function generateRecommendations(
  strategy: "bruteforce" | "hnsw" | "ivf",
  evalResults: EvalItem[],
  docCount: number,
): string[] {
  const suggestions: string[] = [];

  if (strategy === "bruteforce") {
    if (docCount >= 10000) {
      suggestions.push("Index size is large; consider HNSW (switchStrategy) for latency reduction.");
    }
  } else if (strategy === "hnsw") {
    const avgRecall = evalResults.length ? evalResults.reduce((s, e) => s + e.recallNum, 0) / evalResults.length : 1;
    const zeroRecall = evalResults.filter((e) => e.recallNum === 0).length;
    if (docCount < 1000)
      suggestions.push("Small dataset detected; bruteforce often provides higher quality (consider BF).");
    if (avgRecall < 0.6) {
      suggestions.push("HNSW recall is low; try higher efSearch (e.g., 200–400).");
      suggestions.push("Consider increasing seeds/bridgeBudget or using hard mode when filters apply.");
    }
    if (zeroRecall > 0) {
      suggestions.push(
        "Some queries have zero recall; consider rebuilding with higher M/efConstruction or shuffling insert order.",
      );
    }
  }

  return suggestions;
}
