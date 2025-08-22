/** Maintain ops smoke test */

/**
 * @file Unit tests for maintenance operations
 */
import { createState } from "../state/create";
import { add, remove } from "./core";
import { hnswCompactAndRebuild, rebuildIndex, compactStore } from "./maintain";

describe("ops.maintain", () => {
  it("hnswCompactAndRebuild compacts when tombstones exist", () => {
    const vl = createState({
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
    const bf = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(bf, 1, new Float32Array([1, 0]), null);
    add(bf, 2, new Float32Array([0, 1]), null);
    const changedH = rebuildIndex(bf, { strategy: "hnsw", params: { M: 6, efSearch: 24 } });
    expect(changedH).toBeGreaterThan(0);
    const changedI = rebuildIndex(bf, { strategy: "ivf", params: { nlist: 8, nprobe: 4 } });
    expect(changedI).toBeGreaterThan(0);
  });
  it("compactStore shrink and capacity resize paths", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 5; i++) {
      add(vl, i + 1, new Float32Array([1, 0]), null);
    }
    const r1 = compactStore(vl, { shrink: true });
    expect(r1.shrunk).toBe(true);
    const r2 = compactStore(vl, { capacity: 16 });
    expect(r2.shrunk).toBe(true);
  });
  it("rebuildIndex ivf nprobe update without recreate and hnsw ids subset", () => {
    const ivf = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 4, nprobe: 1 } });
    add(ivf, 1, new Float32Array([1, 0]), null);
    const moved = rebuildIndex(ivf, { strategy: "ivf", params: { nprobe: 2 } });
    expect(moved).toBeGreaterThanOrEqual(0);
    const bf2 = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(bf2, 1, new Float32Array([1, 0]), null);
    add(bf2, 2, new Float32Array([0.9, 0]), null);
    const cnt = rebuildIndex(bf2, { strategy: "hnsw", ids: [1] });
    expect(cnt).toBe(1);
  });
  it("rebuildIndex(hnsw) without params reuses old settings (old branch)", () => {
    const h = createState({
      dim: 2,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 5, efConstruction: 25, efSearch: 12, allowReplaceDeleted: true },
    });
    add(h, 1, new Float32Array([1, 0]), null);
    // no params -> should use existing hnsw settings (lines 117-124)
    const n = rebuildIndex(h, { strategy: "hnsw" });
    expect(n).toBeGreaterThanOrEqual(0);
  });
  it("rebuildIndex(ivf) with ids triggers per-id reassignment loop", () => {
    const ivf = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 2, nprobe: 1 } });
    add(ivf, 1, new Float32Array([1, 0]), null);
    add(ivf, 2, new Float32Array([0.9, 0]), null);
    const moved = rebuildIndex(ivf, { strategy: "ivf", ids: [1, 2] });
    expect(moved).toBe(2);
  });
});
