/**
 * Construction utilities for VectorLite.
 *
 * Why: Separate creation from operations and (de)serialization so each module
 * remains focused and easier to reason about and test.
 */
import type { VectorLiteOptions } from "../types";
import type { Metric } from "../types";
import { createStore } from "../core/store";
import { createBruteforceState } from "../ann/bruteforce";
import { createHNSWState } from "../ann/hnsw";
import { createIVFState } from "../ann/ivf";
import type { VectorLiteState, VectorLiteAnn } from "./state";

/**
 *
 */
export function createVectorLite<TMeta = unknown>(opts: VectorLiteOptions): VectorLiteState<TMeta> {
  const dim = opts.dim;
  const metric: Metric = opts.metric ?? "cosine";
  const strategy = opts.strategy ?? "bruteforce";
  if (metric !== "cosine" && metric !== "l2" && metric !== "dot") {
    throw new Error(`Unsupported metric: ${String(metric)}. Use 'cosine' | 'l2' | 'dot'.`);
  }
  if (strategy !== "bruteforce" && strategy !== "hnsw" && strategy !== "ivf") {
    throw new Error(`Unsupported strategy: ${String(strategy)}. Use 'bruteforce' | 'hnsw' | 'ivf'.`);
  }
  const store = createStore<TMeta>(dim, metric, opts.capacity ?? 1024);
  let ann: VectorLiteAnn;
  if (strategy === "hnsw") {
    ann = createHNSWState(opts.hnsw ?? {}, metric, store._capacity);
  } else if (strategy === "ivf") {
    ann = createIVFState(opts.ivf ?? {}, metric, dim);
  } else {
    ann = createBruteforceState(metric);
  }
  return { dim, metric, store, strategy, ann };
}
