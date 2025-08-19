/**
 * @file Rule-based monitoring and alerting system for VectorLite operations
 *
 * This module provides a flexible framework for monitoring VectorLite instances
 * and generating operational alerts based on configurable rules. Key features:
 *
 * - Performance monitoring: Detect when bruteforce search becomes inefficient
 *   for large datasets and suggest switching to HNSW or IVF
 * - Index health checks: Monitor HNSW graph connectivity (average degree) and
 *   IVF cluster balance to ensure optimal search performance
 * - Maintenance alerts: Identify when HNSW tombstone ratios indicate need for
 *   compaction or when IVF centroids should be retrained
 * - Extensible rule system: Register custom rules to monitor application-specific
 *   metrics and generate alerts based on your requirements
 *
 * The rule system operates in a read-only manner, analyzing VectorLite state
 * without making modifications. This allows safe monitoring in production
 * environments where operators can review alerts and decide on actions.
 *
 * Used by applications that need proactive monitoring of vector database health
 * and performance, enabling preventive maintenance before issues impact users.
 */
import type { VectorLiteState } from "../types";
import type { Metric } from "../types";
import { isHnswVL, isIvfVL } from "../util/guards";

export type HnswStats = { levels: number; avgDeg: number };
export type IvfStats = { nlist: number; nprobe: number; listSizeHist: number[] };
export type StatsView = {
  n: number;
  dim: number;
  strategy: "bruteforce" | "hnsw" | "ivf";
  metric: Metric;
  hnsw?: HnswStats;
  ivf?: IvfStats;
};

export type Alert = { code: string; message: string; severity?: "info" | "warn" | "error" };
export type Rule<TMeta> = (ctx: { vl: VectorLiteState<TMeta>; stats: StatsView }) => Alert | Alert[] | null;

const registry: Rule<unknown>[] = [];

/**
 *
 */
export function registerRules<TMeta>(rules: Rule<TMeta>[]): void {
  for (const r of rules) registry.push(r as unknown as Rule<unknown>);
}

/**
 *
 */
export function clearRules(): void {
  registry.splice(0, registry.length);
}

function computeStatsView<TMeta>(vl: VectorLiteState<TMeta>): StatsView {
  const base = { n: vl.store._count, dim: vl.dim, strategy: vl.strategy, metric: vl.metric as Metric };
  if (isHnswVL(vl)) {
    // avgDeg across all layers / nodes (rough indicator)
    // eslint-disable-next-line no-restricted-syntax -- accumulating counter for readability and performance
    let edges = 0;
    for (let l = 0; l <= vl.ann.maxLevel; l++) {
      const layer = vl.ann.links[l] || [];
      for (let i = 0; i < layer.length; i++) edges += layer[i]?.length || 0;
    }
    const nodes = Math.max(1, vl.store._count);
    const avgDeg = edges / nodes;
    return { ...base, hnsw: { levels: Math.max(0, vl.ann.maxLevel), avgDeg } };
  }
  if (isIvfVL(vl)) {
    const sizes = vl.ann.lists.map((a) => a.length);
    return { ...base, ivf: { nlist: vl.ann.nlist, nprobe: vl.ann.nprobe, listSizeHist: sizes } };
  }
  return base as StatsView;
}

function hnswTombstoneRatio<TMeta>(vl: VectorLiteState<TMeta>): number | null {
  if (!isHnswVL(vl)) return null;
  // eslint-disable-next-line no-restricted-syntax -- accumulating counter for readability and performance
  let dead = 0;
  for (let i = 0; i < vl.store._count; i++) if (vl.ann.tombstone[i] === 1) dead++;
  const n = Math.max(1, vl.store._count);
  return dead / n;
}

/** Evaluate all registered rules on the given instance. */
export function evaluateRules<TMeta>(vl: VectorLiteState<TMeta>): Alert[] {
  const stats = computeStatsView(vl);
  const out: Alert[] = [];
  for (const r of registry) {
    const res = (r as Rule<TMeta>)({ vl, stats });
    if (res == null) continue;
    if (Array.isArray(res)) out.push(...res);
    else out.push(res);
  }
  return out;
}

// ---- Built-in helper rules (optional) ----

/** Large dataset on bruteforce suggests switching to ANN. */
export function ruleLargeDatasetBF<TMeta>(threshold = 10000): Rule<TMeta> {
  return ({ stats }) => {
    if (stats.strategy === "bruteforce" && stats.n >= threshold) {
      return {
        code: "bf.large-dataset",
        severity: "warn",
        message: "Large dataset on BF; consider HNSW/IVF for latency.",
      };
    }
    return null;
  };
}

/** Low average degree on HNSW suggests tuning M/efConstruction. */
export function ruleHnswLowDegree<TMeta>(minAvgDeg = 4): Rule<TMeta> {
  return ({ stats }) => {
    if (stats.strategy === "hnsw" && stats.hnsw && stats.hnsw.avgDeg < minAvgDeg) {
      return {
        code: "hnsw.low-avg-degree",
        severity: "info",
        message: "HNSW avgDeg low; consider increasing M or efConstruction.",
      };
    }
    return null;
  };
}

/** Imbalanced IVF lists suggest retraining centroids. */
export function ruleIvfImbalance<TMeta>(factor = 2): Rule<TMeta> {
  return ({ stats }) => {
    if (stats.strategy === "ivf" && stats.ivf) {
      const arr = stats.ivf.listSizeHist;
      if (arr.length === 0) return null;
      const avg = arr.reduce((x, y) => x + y, 0) / arr.length;
      for (const x of arr)
        if (x > factor * avg)
          return {
            code: "ivf.imbalance",
            severity: "info",
            message: "IVF list imbalance; consider retraining centroids.",
          };
    }
    return null;
  };
}

/** High tombstone ratio on HNSW suggests compaction. */
export function ruleHnswTombstone<TMeta>(ratio = 0.3): Rule<TMeta> {
  return ({ vl, stats }) => {
    if (stats.strategy !== "hnsw") return null;
    const r = hnswTombstoneRatio(vl);
    if (r !== null && r > ratio) {
      return {
        code: "hnsw.tombstone-high",
        severity: "warn",
        message: "HNSW tombstone ratio high; consider compaction.",
      };
    }
    return null;
  };
}
