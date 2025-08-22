/**
 * @file Extra tests for IVF branches: remove path, dim mismatch, l2 evaluate
 */
import { createState } from "../attr/state/create";
import { add, remove } from "../attr/ops/core";
import { evaluateIvf, trainIvfCentroids as trainOps, reassignIvfLists as reassignOps } from "../attr/ops/ivf";
import { ivf_search } from "./ivf";
import type { IVFState } from "./ivf";
import { isIvfVL } from "../util/guards";

describe("ann/ivf extra branches", () => {
  it("ivf_remove via core.remove handles present and missing ids", () => {
    const db = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 2, nprobe: 1 } });
    add(db, 1, new Float32Array([1, 0]));
    add(db, 2, new Float32Array([0.9, 0]));
    // remove existing id (hits splice path)
    expect(remove(db, 1)).toBe(true);
    // removing missing triggers early return path
    expect(remove(db, 9999)).toBe(false);
  });

  it("ivf_search throws on query length mismatch", () => {
    const db = createState({ dim: 3, metric: "cosine", strategy: "ivf", ivf: { nlist: 2, nprobe: 1 } });
    add(db, 1, new Float32Array([1, 0, 0]));
    if (!isIvfVL(db)) {
      throw new Error("expected ivf VL");
    }
    expect(() => ivf_search(db.ann as IVFState, db.store, new Float32Array([1, 0]), 1)).toThrow(/dim mismatch/);
  });

  it("ivf_evaluate covers l2 branch", () => {
    const db = createState({ dim: 2, metric: "l2", strategy: "ivf", ivf: { nlist: 2, nprobe: 2 } });
    add(db, 1, new Float32Array([1, 0]));
    add(db, 2, new Float32Array([0, 1]));
    const r = evaluateIvf(db, [new Float32Array([1, 0])], 1);
    expect(r.recall).toBeGreaterThanOrEqual(0);
  });

  it("ivf_trainCentroids and reassign cover l2 scoring paths", () => {
    const db = createState({ dim: 2, metric: "l2", strategy: "ivf", ivf: { nlist: 2, nprobe: 2 } });
    add(db, 1, new Float32Array([1, 0]));
    add(db, 2, new Float32Array([0.9, 0.1]));
    add(db, 3, new Float32Array([0, 1]));
    add(db, 4, new Float32Array([0.1, 0.9]));
    const t = trainOps(db, { iters: 2, seed: 1 });
    expect(t.updated).toBeGreaterThan(0);
    const r2 = reassignOps(db);
    expect(r2.moved).toBeGreaterThan(0);
  });
});
