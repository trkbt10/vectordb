import { createVectorLite, add, searchWithExpr } from "../vectorlite";
import { createAttrIndex, setAttrs, removeId } from "../attr/index";
import type { FilterExpr } from "../filter/expr";

test("filter expr: equality and range with index, bruteforce", () => {
  const db = createVectorLite<{ memo?: string }>({ dim: 3, metric: "cosine", strategy: "bruteforce" });
  add(db, 1, new Float32Array([1, 0, 0]), { memo: "a" });
  add(db, 2, new Float32Array([0.99, 0, 0]), { memo: "b" });
  add(db, 3, new Float32Array([0.5, 0, 0]), { memo: "c" });

  const idx = createAttrIndex();
  setAttrs(idx, 1, { color: "red", price: 10 });
  setAttrs(idx, 2, { color: "blue", price: 20 });
  setAttrs(idx, 3, { color: "red", price: 15 });

  const expr: FilterExpr = {
    must: [
      { key: "color", match: "red" },
      { key: "price", range: { gte: 10, lt: 20 } },
    ],
  };
  const hits = searchWithExpr(db, new Float32Array([1, 0, 0]), expr, { k: 3, index: idx });
  const ids = hits.map((h) => h.id).sort((a, b) => a - b);
  expect(ids).toEqual([1, 3]);
});

test("filter expr: has_id and must_not/should", () => {
  const db = createVectorLite<{ memo?: string }>({ dim: 2 });
  add(db, 10, new Float32Array([1, 0]), null);
  add(db, 11, new Float32Array([0.9, 0]), null);
  add(db, 12, new Float32Array([0.8, 0]), null);

  const idx = createAttrIndex();
  setAttrs(idx, 10, { tag: ["a", "b"] });
  setAttrs(idx, 11, { tag: ["b"] });
  setAttrs(idx, 12, { tag: ["c"] });

  const expr: FilterExpr = {
    has_id: { values: [10, 11, 12] },
    must_not: [{ key: "tag", match: "c" }],
    should: [{ key: "tag", match: "a" }],
    should_min: 0,
  };
  const hits = searchWithExpr(db, new Float32Array([1, 0]), expr, { k: 5, index: idx });
  const ids = hits.map((h) => h.id).sort((a, b) => a - b);
  expect(ids).toEqual([10, 11]);
});

test("attr index removal stays consistent", () => {
  const db = createVectorLite({ dim: 2 });
  add(db, 1, new Float32Array([1, 0]));
  add(db, 2, new Float32Array([0.9, 0]));
  const idx = createAttrIndex();
  setAttrs(idx, 1, { group: "g1" });
  setAttrs(idx, 2, { group: "g2" });
  removeId(idx, 2);
  const expr: FilterExpr = { key: "group", match: "g2" };
  const hits = searchWithExpr(db, new Float32Array([1, 0]), expr, { k: 5, index: idx });
  expect(hits.length).toBe(0);
});

test("HNSW hard-mode respects candidate ids", () => {
  const db = createVectorLite<{ tag?: string }>({
    dim: 3,
    strategy: "hnsw",
    hnsw: { M: 6, efConstruction: 32, efSearch: 16, seed: 7 },
  });
  add(db, 1, new Float32Array([1, 0, 0]), { tag: "a" });
  add(db, 2, new Float32Array([0.95, 0, 0]), { tag: "b" });
  add(db, 3, new Float32Array([0, 1, 0]), { tag: "c" });
  const idx = createAttrIndex();
  setAttrs(idx, 1, { color: "red" });
  setAttrs(idx, 2, { color: "blue" });
  setAttrs(idx, 3, { color: "red" });
  const expr: FilterExpr = { key: "color", match: "red" };
  const hits = searchWithExpr(db, new Float32Array([1, 0, 0]), expr, { k: 3, index: idx, hnsw: { mode: "hard" } });
  const ids = hits.map((h) => h.id).sort((a, b) => a - b);
  expect(ids).toEqual([1, 3]);
});

test("HNSW soft-mode bridges limited steps", () => {
  const db = createVectorLite<{ tag?: string }>({
    dim: 2,
    strategy: "hnsw",
    hnsw: { M: 6, efConstruction: 32, efSearch: 8, seed: 3 },
  });
  add(db, 1, new Float32Array([1, 0]), { tag: "a" });
  add(db, 2, new Float32Array([0.95, 0]), { tag: "b" });
  add(db, 3, new Float32Array([0, 1]), { tag: "c" });
  const idx = createAttrIndex();
  setAttrs(idx, 1, { group: "g1" });
  setAttrs(idx, 2, { group: "g2" });
  setAttrs(idx, 3, { group: "g2" });
  const expr: FilterExpr = { key: "group", match: "g2" };
  const hitsSoft = searchWithExpr(db, new Float32Array([1, 0]), expr, {
    k: 2,
    index: idx,
    hnsw: {
      mode: "soft",
      bridgeBudget: 4,
      seeds: "auto",
      adaptiveEf: { base: 2, min: 8, max: 64 },
      earlyStop: { margin: 0 },
    },
  });
  expect(hitsSoft.length).toBeGreaterThan(0);
});
