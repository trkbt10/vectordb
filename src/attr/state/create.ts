/**
 * @file VectorDB instance creation and initialization
 *
 * This module handles the creation of new VectorDB instances with proper
 * initialization of all components. It provides:
 * - Factory function for creating VectorDB state with chosen strategy
 * - Validation of configuration parameters (dimensions, metrics, strategies)
 * - Proper initialization of storage and ANN strategy components
 * - Type-safe construction with compile-time guarantees
 *
 * By separating creation logic from operations and serialization, this module
 * ensures clean separation of concerns and makes the codebase more maintainable
 * and testable.
 */
import type { VectorDBOptions } from "../../types";
import type { Metric } from "../../types";
import { createStore } from "../store/store";
import { createBruteforceState } from "../../ann/bruteforce";
import { createHNSWState } from "../../ann/hnsw";
import { createIVFState } from "../../ann/ivf";
import type { VectorStoreState, ANNs } from "../../types";

/**
 *
 */
export function createState<TMeta = unknown>(opts: VectorDBOptions): VectorStoreState<TMeta> {
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
  // eslint-disable-next-line no-restricted-syntax -- Strategy pattern: ANN instance depends on strategy type
  let ann: ANNs;
  if (strategy === "hnsw") {
    ann = createHNSWState(opts.hnsw ?? {}, metric, store._capacity);
  } else if (strategy === "ivf") {
    ann = createIVFState(opts.ivf ?? {}, metric, dim);
  } else {
    ann = createBruteforceState(metric);
  }
  return { dim, metric, store, strategy, ann };
}
