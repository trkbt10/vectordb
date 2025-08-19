/**
 * @file Tests for IVF strategy and utilities.
 */

import { createVectorLiteState } from "../attr/vectorlite/create";
import { add, search, buildIVFFromStore } from "../attr/vectorlite/ops/core";

describe("IVF basic behavior", () => {
  it("returns similar results to BF on clustered data", () => {
    const dim = 4;
    const db = createVectorLiteState({ dim, metric: "cosine", strategy: "bruteforce" });
    // two clusters around e1 and e2
    const e1 = new Float32Array([1, 0, 0, 0]);
    const e2 = new Float32Array([0, 1, 0, 0]);
    function jitter(base: Float32Array, eps: number) {
      const v = new Float32Array(dim);
      for (let i = 0; i < dim; i++) v[i] = base[i] + (Math.random() * 2 - 1) * eps;
      return v;
    }
    for (let i = 0; i < 50; i++) add(db, 100 + i, jitter(e1, 0.05), null);
    for (let i = 0; i < 50; i++) add(db, 200 + i, jitter(e2, 0.05), null);

    const q1 = jitter(e1, 0.02);
    const q2 = jitter(e2, 0.02);
    const bf1 = search(db, q1, { k: 5 }).map((h) => h.id);
    const bf2 = search(db, q2, { k: 5 }).map((h) => h.id);

    // switch to IVF and compare recall
    const dbIVF = buildIVFFromStore(db, { nlist: 8, nprobe: 4 });
    const ivf1 = search(dbIVF, q1, { k: 5 }).map((h) => h.id);
    const ivf2 = search(dbIVF, q2, { k: 5 }).map((h) => h.id);

    function recall(a: number[], b: number[]) {
      const sb = new Set(b);
      let m = 0;
      for (const x of a) if (sb.has(x)) m++;
      return m / a.length;
    }
    expect(recall(bf1, ivf1)).toBeGreaterThanOrEqual(0.6);
    expect(recall(bf2, ivf2)).toBeGreaterThanOrEqual(0.6);
  });
});
/**
 * @file Tests for IVF strategy and utilities.
 */
