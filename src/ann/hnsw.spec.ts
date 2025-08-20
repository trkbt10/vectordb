/**
 * @file Tests for HNSW strategy behavior.
 */

import { createMemoryFileIO } from "../persist/memory";
import { computeNumSeeds } from "./hnsw";
import { CrushMap } from "../indexing/types";
import { add, search, remove, getOne } from "../attr/ops/core";
import { persistIndex, openFromIndex } from "../attr/ops/index_persist";
import { hnswCompactAndRebuild } from "../attr/ops/maintain";
import { createState } from "../attr/state/create";

test("VectorLite HNSW: searches and roundtrips", async () => {
  const dim = 4;
  const db = createState<{ tag: string }>({
    dim,
    strategy: "hnsw",
    hnsw: { M: 8, efConstruction: 32, efSearch: 16, seed: 123 },
  });
  add(db, 1, new Float32Array([1, 0, 0, 0]), { tag: "A" });
  add(db, 2, new Float32Array([0.9, 0, 0, 0]), { tag: "B" });
  add(db, 3, new Float32Array([0, 1, 0, 0]), { tag: "C" });
  add(db, 4, new Float32Array([0, 0.9, 0, 0]), { tag: "D" });
  const hits = search(db, new Float32Array([0.95, 0, 0, 0]), { k: 2 });
  expect(hits.length).toBe(2);

  // roundtrip through separated index/data
  const crush: CrushMap = { pgs: 8, replicas: 1, targets: [{ key: "a" }, { key: "b" }] };
  const dataStores: Record<string, ReturnType<typeof createMemoryFileIO>> = {
    a: createMemoryFileIO(),
    b: createMemoryFileIO(),
  };
  const indexStore = createMemoryFileIO();
  await persistIndex(db, {
    baseName: "hnsw_spec",
    crush,
    resolveDataIO: (k) => dataStores[k],
    resolveIndexIO: () => indexStore,
    includeAnn: false,
  });
  const db2 = await openFromIndex<{ tag: string }>({
    baseName: "hnsw_spec",
    crush,
    resolveDataIO: (k) => dataStores[k],
    resolveIndexIO: () => indexStore,
  });
  const hits2 = search(db2, new Float32Array([0.95, 0, 0, 0]), { k: 2 });
  expect(hits2.length).toBe(2);
});

test("HNSW remove + compact rebuild drops tombstones", () => {
  const dim = 3;
  const db = createState<{ tag?: string }>({
    dim,
    strategy: "hnsw",
    hnsw: { M: 8, efConstruction: 32, efSearch: 16, seed: 7 },
  });
  add(db, 1, new Float32Array([1, 0, 0]), null);
  add(db, 2, new Float32Array([0, 1, 0]), null);
  add(db, 3, new Float32Array([0, 0, 1]), null);
  expect(search(db, new Float32Array([1, 0, 0]), { k: 1 })[0].id).toBe(1);
  remove(db, 1);
  const removedHit = search(db, new Float32Array([1, 0, 0]), { k: 1 })[0];
  expect(removedHit.id).not.toBe(1);
  const removed = hnswCompactAndRebuild(db);
  expect(removed).toBe(1);
  expect(getOne(db, 1)).toBeNull();
});

test("computeNumSeeds auto and clamping", () => {
  expect(computeNumSeeds(0, "auto")).toBe(1);
  expect(computeNumSeeds(4, "auto")).toBe(2);
  expect(computeNumSeeds(100, "auto")).toBeLessThanOrEqual(8);
  expect(computeNumSeeds(10, 0)).toBe(1);
  expect(computeNumSeeds(10, 5)).toBe(5);
  expect(computeNumSeeds(10, 100)).toBe(32);
});
