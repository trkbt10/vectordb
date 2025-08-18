
/**
 * @file Tests for HNSW strategy behavior.
 */

import {
  createVectorLiteState,
  deserializeVectorLite,
  add,
  search,
  serialize,
  remove,
  hnswCompactAndRebuild,
  get,
} from "../vectorlite";
import { computeNumSeeds } from "./hnsw";

test("VectorLite HNSW: searches and roundtrips", () => {
  const dim = 4;
  const db = createVectorLiteState<{ tag: string }>({
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

  const buf = serialize(db);
  const db2 = deserializeVectorLite<{ tag: string }>(buf);
  const hits2 = search(db2, new Float32Array([0.95, 0, 0, 0]), { k: 2 });
  expect(hits2.length).toBe(2);
});

test("HNSW remove + compact rebuild drops tombstones", () => {
  const dim = 3;
  const db = createVectorLiteState<{ tag?: string }>({
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
  expect(get(db, 1)).toBeNull();
});

test("computeNumSeeds auto and clamping", () => {
  expect(computeNumSeeds(0, "auto")).toBe(1);
  expect(computeNumSeeds(4, "auto")).toBe(2);
  expect(computeNumSeeds(100, "auto")).toBeLessThanOrEqual(8);
  expect(computeNumSeeds(10, 0)).toBe(1);
  expect(computeNumSeeds(10, 5)).toBe(5);
  expect(computeNumSeeds(10, 100)).toBe(32);
});
/**
 * @file Tests for HNSW strategy behavior.
 */
