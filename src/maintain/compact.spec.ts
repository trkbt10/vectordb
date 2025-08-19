/**
 * Compaction / Rebuild spec
 */
import { createState } from "../attr/state/create";
import { add, remove } from "../attr/ops/core";
import { compactStore, rebuildIndex } from "../attr/ops/maintain";

describe("compact/rebuild", () => {
  it("shrinks store capacity and rebuilds HNSW when tombstones exceed ratio", () => {
    const vl = createState({
      dim: 2,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 4, efConstruction: 50 },
    });
    for (let i = 0; i < 100; i++) add(vl, i + 1, new Float32Array([i % 2, (i + 1) % 2]), null);
    // grow capacity, then shrink
    compactStore(vl, { shrink: true });
    const cap1 = vl.store._capacity;
    expect(cap1).toBeGreaterThanOrEqual(vl.store._count);
    // delete 50% to create tombstones
    for (let i = 0; i < 50; i++) remove(vl, i + 1);
    const res = compactStore(vl, { tombstoneRatio: 0.3 });
    expect(res.rebuilt).toBeGreaterThan(0);
  });

  it("rebuilds IVF with new nlist and reassigns", () => {
    const vl = createState({ dim: 3, metric: "cosine", strategy: "ivf", ivf: { nlist: 4, nprobe: 2 } });
    for (let i = 0; i < 60; i++) add(vl, i + 1, new Float32Array([i % 3, (i + 1) % 3, (i + 2) % 3]), null);
    const changed = rebuildIndex(vl, { strategy: "ivf", params: { nlist: 8, nprobe: 4 } });
    expect(changed).toBeGreaterThan(0);
  });
});
