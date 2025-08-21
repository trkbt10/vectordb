/**
 * HNSW tuning spec.
 *
 * Why: Verify suggestions are returned and recall values are bounded.
 */

/**
 * @file Unit tests for tuning operations
 */
import { createState } from "../state/create";
import { add } from "./core";
import { tuneHnsw } from "./tune";
import { isHnswVL } from "../../util/guards";
// Avoid mocking; test only functional paths

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

  it("builds candidate when M differs and returns suggestions", () => {
    const base = createState({
      dim: 2,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 4, efConstruction: 8, efSearch: 4 },
    });
    for (let i = 0; i < 20; i++) add(base, i + 1, new Float32Array([i % 2, (i + 1) % 2]));
    const qs = [new Float32Array([1, 0]), new Float32Array([0, 1])];
    // First, ensure path when M differs is exercised
    if (!isHnswVL(base)) throw new Error("expected HNSW state");
    const res1 = tuneHnsw(base, { M: [base.ann.M + 1], efSearch: [base.ann.efSearch] }, qs, 3);
    expect(res1.length).toBeGreaterThan(0);
    const res2 = tuneHnsw(base, { M: [base.ann.M + 2], efSearch: [base.ann.efSearch] }, qs, 2);
    expect(res2.length).toBeGreaterThan(0);
  });
});
