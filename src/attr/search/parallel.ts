/**
 * @file Parallel search execution with sharding strategies
 *
 * This module enables distributed vector search across multiple shards for improved
 * performance and scalability. It provides:
 * - Sharding strategies (range-based and hash-based) to partition vector IDs
 * - Parallel search execution across shards with result aggregation
 * - Support for filtering and expression-based queries across all shards
 *
 * The parallel search system allows large vector databases to be split into smaller
 * chunks that can be searched concurrently, reducing latency and enabling horizontal
 * scaling of search operations.
 */

import { searchWithExpr } from "./with_expr";
import type { VectorStoreState } from "../../types";
import type { FilterExpr } from "../filter/expr";
import type { SearchHit } from "../../types";

export type ShardPlan = {
  shards: { name: string; ids: number[] }[];
};

/**
 *
 */
export function createShardPlanByRange(ids: number[], shards: number): ShardPlan {
  const sorted = Array.from(ids).sort((a, b) => a - b);
  const out: ShardPlan = { shards: [] };
  const n = Math.max(1, shards | 0);
  for (let i = 0; i < n; i++) {
    out.shards.push({ name: `shard-${i}`, ids: [] });
  }
  for (let i = 0; i < sorted.length; i++) {
    out.shards[i % n]!.ids.push(sorted[i]!);
  }
  return out;
}

/** Create shard plan by hashing id modulo shard count. */
export function createShardPlanByHash(ids: number[], shards: number): ShardPlan {
  const out: ShardPlan = { shards: [] };
  const n = Math.max(1, shards | 0);
  for (let i = 0; i < n; i++) {
    out.shards.push({ name: `shard-${i}`, ids: [] });
  }
  for (const id of ids) {
    out.shards[(id >>> 0) % n]!.ids.push(id);
  }
  return out;
}

/** Convenience wrapper: choose plan by 'range' or 'hash'. */
export function createShardPlan(ids: number[], opts: { by: "range" | "hash"; shards: number }): ShardPlan {
  if (opts.by === "hash") {
    return createShardPlanByHash(ids, opts.shards);
  }
  return createShardPlanByRange(ids, opts.shards);
}

/**
 *
 */
export function searchParallel<TMeta>(
  vl: VectorStoreState<TMeta>,
  q: Float32Array,
  opts: { k: number; plan?: ShardPlan; expr?: FilterExpr },
) {
  const plan = opts.plan ?? createShardPlanByRange(Array.from(vl.store.ids.subarray(0, vl.store._count)), 1);
  const k = Math.max(1, opts.k | 0);
  const out: SearchHit<TMeta>[] = [];
  for (const shard of plan.shards) {
    function shardExpr(): FilterExpr {
      if (opts.expr) {
        return { has_id: { values: shard.ids }, must: [opts.expr] };
      }
      return { has_id: { values: shard.ids } };
    }
    const expr = shardExpr();
    const res = searchWithExpr(vl, q, expr, { k });
    for (const h of res) {
      // eslint-disable-next-line no-restricted-syntax -- Insert position accumulator for small-k
      let ins = out.length;
      for (let i = 0; i < out.length; i++) {
        if (h.score > out[i]!.score) {
          ins = i;
          break;
        }
      }
      out.splice(ins, 0, h);
      if (out.length > k) {
        out.length = k;
      }
    }
  }
  return out;
}
