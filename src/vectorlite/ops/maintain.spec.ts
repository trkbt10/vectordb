/** Maintain ops smoke test */
import { describe, it, expect } from "vitest";
import { createVectorLiteState } from "../create";
import { add, remove } from "./core";
import { hnswCompactAndRebuild, rebuildIndex } from "./maintain";

describe("ops.maintain", () => {
  it("hnswCompactAndRebuild compacts when tombstones exist", () => {
    const vl = createVectorLiteState({
      dim: 2,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 4, efConstruction: 32 },
    });
    add(vl, 1, new Float32Array([1, 0]), null);
    add(vl, 2, new Float32Array([0, 1]), null);
    remove(vl, 1);
    const removed = hnswCompactAndRebuild(vl);
    expect(removed).toBeGreaterThan(0);
  });
  it("rebuildIndex switches to hnsw and ivf with params", () => {
    const bf = createVectorLiteState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(bf, 1, new Float32Array([1, 0]), null);
    add(bf, 2, new Float32Array([0, 1]), null);
    const changedH = rebuildIndex(bf, { strategy: "hnsw", params: { M: 6, efSearch: 24 } });
    expect(changedH).toBeGreaterThan(0);
    const changedI = rebuildIndex(bf, { strategy: "ivf", params: { nlist: 8, nprobe: 4 } });
    expect(changedI).toBeGreaterThan(0);
  });
});
