/**
 * @file Unit tests for parallel search and sharding utilities
 */
import { createState } from "../state/create";
import { add } from "../ops/core";
import { createShardPlanByRange, createShardPlanByHash, createShardPlan, searchParallel } from "./parallel";
import { FilterExpr } from "../filter/expr";

describe("attr/search/parallel", () => {
  test("createShardPlanByRange distributes sorted ids round-robin", () => {
    const ids = [3, 1, 2, 5, 4];
    const plan = createShardPlanByRange(ids, 2);
    expect(plan.shards).toHaveLength(2);
    expect(plan.shards[0]?.name).toBe("shard-0");
    expect(plan.shards[1]?.name).toBe("shard-1");
    // sorted: [1,2,3,4,5] => rr => [1,3,5], [2,4]
    expect(plan.shards[0]?.ids).toEqual([1, 3, 5]);
    expect(plan.shards[1]?.ids).toEqual([2, 4]);
  });

  test("createShardPlanByHash distributes by id modulo shard count", () => {
    const ids = [1, 2, 3, 4, 5, 6];
    const plan = createShardPlanByHash(ids, 2);
    // odd -> shard-1, even -> shard-0 (because (id >>> 0) % 2)
    expect(plan.shards[0]?.ids).toEqual([2, 4, 6]);
    expect(plan.shards[1]?.ids).toEqual([1, 3, 5]);
  });

  test("createShardPlan chooses implementation by option", () => {
    const ids = [10, 11, 12, 13];
    const hash = createShardPlan(ids, { by: "hash", shards: 3 });
    const range = createShardPlan(ids, { by: "range", shards: 3 });
    expect(hash.shards.map((s) => s.name)).toEqual(["shard-0", "shard-1", "shard-2"]);
    expect(range.shards.map((s) => s.name)).toEqual(["shard-0", "shard-1", "shard-2"]);
  });

  test("searchParallel aggregates top-k across shards with optional expr", () => {
    const db = createState<{ tag?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    // Add 6 points mostly along x-axis with slight variance
    add(db, 1, new Float32Array([1.0, 0.0]), { tag: "a" });
    add(db, 2, new Float32Array([0.95, 0.0]), { tag: "b" });
    add(db, 3, new Float32Array([0.9, 0.1]), { tag: "a" });
    add(db, 4, new Float32Array([0.5, 0.5]), { tag: "b" });
    add(db, 5, new Float32Array([0.25, 0.2]), { tag: "a" });
    add(db, 6, new Float32Array([0.0, 1.0]), { tag: "b" });

    // Fixed plan: 2 shards splitting by range (to get deterministic buckets)
    const plan = createShardPlanByRange([1, 2, 3, 4, 5, 6], 2);
    const q = new Float32Array([1, 0]);

    // No expr: returns overall top-3 by cosine similarity
    const top3 = searchParallel(db, q, { k: 3, plan });
    expect(top3).toHaveLength(3);
    // should include best scoring ids near x-axis: 1,2,3
    const ids = top3.map((h) => h.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    // scores must be non-increasing
    for (let i = 1; i < top3.length; i++) {
      expect(top3[i]!.score).toBeLessThanOrEqual(top3[i - 1]!.score);
    }

    // With expr limiting to ids {2,4,6}, ensure filter is respected per-shard
    const expr: FilterExpr = { has_id: { values: [2, 4, 6] } } as const;
    const filtered = searchParallel(db, q, { k: 3, plan, expr });
    expect(filtered.map((h) => h.id).sort((a, b) => a - b)).toEqual([2, 4, 6]);
  });
});
