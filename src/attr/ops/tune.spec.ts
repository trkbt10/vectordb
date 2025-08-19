/**
 * HNSW tuning spec.
 *
 * Why: Verify suggestions are returned and recall values are bounded.
 */

import { createState } from "../state/create";
import { add } from "./core";
import { tuneHnsw } from "./tune";

describe("ops.tune", () => {
  it("returns suggestions with bounded recall", () => {
    const bf = createState({ dim: 3, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 50; i++) add(bf, i + 1, new Float32Array([1, 0, 0]), null);
    for (let i = 0; i < 50; i++) add(bf, 100 + i, new Float32Array([0, 1, 0]), null);
    const h = createState({
      dim: 3,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 8, efConstruction: 32, efSearch: 16 },
    });
    // copy data
    for (let i = 0; i < bf.store._count; i++)
      add(h, bf.store.ids[i], bf.store.data.subarray(i * 3, i * 3 + 3), bf.store.metas[i]);
    const qs = [new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])];
    const res = tuneHnsw(h, { efSearch: [8, 16], M: [8] }, qs, 5);
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      expect(r.recall).toBeGreaterThanOrEqual(0);
      expect(r.recall).toBeLessThanOrEqual(1);
    }
  });
});
