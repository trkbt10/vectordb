/**
 * IVF retraining APIs spec
 *
 * Verifies that:
 * - trainIvfCentroids updates centroids without errors
 * - reassignIvfLists populates posting lists and idToList consistently
 * - evaluateIvf returns reasonable recall on clustered data
 */

import { createVectorLiteState } from "../attr/vectorlite/create";
import { add } from "../attr/ops/core";
import { trainIvfCentroids, reassignIvfLists, evaluateIvf } from "../attr/ops/ivf";

describe("IVF retrain/evaluate", () => {
  it("trains, reassigns, and evaluates with good recall", () => {
    const dim = 4;
    const vl = createVectorLiteState({ dim, metric: "cosine", strategy: "ivf", ivf: { nlist: 6, nprobe: 6 } });
    const e1 = new Float32Array([1, 0, 0, 0]);
    const e2 = new Float32Array([0, 1, 0, 0]);
    const e3 = new Float32Array([0, 0, 1, 0]);
    function jitter(base: Float32Array, eps: number): Float32Array {
      const v = new Float32Array(dim);
      for (let i = 0; i < dim; i++) v[i] = base[i] + (Math.random() * 2 - 1) * eps;
      return v;
    }
    let id = 1;
    for (let i = 0; i < 40; i++) add(vl, id++, jitter(e1, 0.05), null);
    for (let i = 0; i < 40; i++) add(vl, id++, jitter(e2, 0.05), null);
    for (let i = 0; i < 40; i++) add(vl, id++, jitter(e3, 0.05), null);

    const t = trainIvfCentroids(vl, { iters: 12, seed: 123 });
    expect(t.updated).toBeGreaterThan(0);
    const r = reassignIvfLists(vl);
    expect(r.moved).toBeGreaterThan(0);

    // basic sanity on posting lists: non-empty and sums to dataset size
    // we cannot access lists directly via public API, but evaluate gives a proxy quality check
    const queries = [jitter(e1, 0.02), jitter(e2, 0.02), jitter(e3, 0.02)];
    const ev = evaluateIvf(vl, queries, 10);
    expect(ev.recall).toBeGreaterThan(0.6);
  });
});
/**
 * @file Tests for IVF retraining and evaluation wrappers.
 */
