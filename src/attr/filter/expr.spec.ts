/**
 * @file Tests for filter expression compilation and evaluation
 */
import { compilePredicate, type FilterExpr, preselectCandidates, type AttrIndexReader, type Scalar } from "./expr";

test("compilePredicate: has_id only and has_id+must", () => {
  const expr1: FilterExpr = { has_id: { values: [1, 2, 3] } };
  const p1 = compilePredicate(expr1);
  expect(p1(2, null)).toBeTruthy();
  expect(p1(4, null)).toBeFalsy();

  const expr2: FilterExpr = { has_id: { values: [1, 2, 3] }, must: [{ key: "lang", match: "en", scope: "meta" }] };
  const p2 = compilePredicate(expr2);
  expect(p2(2, { lang: "en" })).toBeTruthy();
  expect(p2(2, { lang: "ja" })).toBeFalsy();
});

test("preselectCandidates: equality and range via reader", () => {
  const reader: AttrIndexReader = {
    eq: (k, v) => (k === "color" && v === "red" ? new Set([1, 3]) : null),
    exists: (k) => (k === "price" ? new Set([1, 2, 3]) : null),
    range: (k, r) => (k === "price" && r.gte === 10 && r.lt === 20 ? new Set([1, 3]) : null),
  };
  const expr: FilterExpr = {
    must: [
      { key: "color", match: "red" },
      { key: "price", range: { gte: 10, lt: 20 } },
    ],
  };
  const s = preselectCandidates(expr, reader);
  expect(s).not.toBeNull();
  expect(Array.from(s!)).toEqual([1, 3]);
});

test("compilePredicate: exists/is_null/range boundaries and array overlap", () => {
  const pExists = compilePredicate({ key: "user.name", scope: "meta", exists: true });
  expect(pExists(1, { user: { name: "a" } })).toBe(true);
  expect(pExists(1, { user: {} })).toBe(false);

  const pNull = compilePredicate({ key: "x", scope: "meta", is_null: true });
  expect(pNull(1, { x: null })).toBe(true);
  expect(pNull(1, { x: 0 })).toBe(false);

  const pRange = compilePredicate({ key: "age", scope: "meta", range: { gte: 10, lt: 20 } });
  expect(pRange(1, { age: 10 })).toBe(true);
  expect(pRange(1, { age: 20 })).toBe(false);

  const pArr = compilePredicate({ key: "tags", scope: "meta", match: ["a", "c"] });
  expect(pArr(1, { tags: ["b", "c"] })).toBe(true);
  expect(pArr(1, { tags: ["x"] })).toBe(false);
});

test("preselectCandidates: must/should/must_not combinations", () => {
  const idx: AttrIndexReader = {
    eq: (k: string, v: Scalar) => (k === "color" && v === "red" ? new Set([1, 3]) : k === "shape" && v === "square" ? new Set([2, 3]) : null),
    exists: (k: string) => (k === "price" ? new Set([1, 2, 3]) : null),
    range: () => null,
  };
  const expr: FilterExpr = {
    must: [{ key: "color", match: "red" }],
    should: [{ key: "shape", match: "square" }, { key: "price", exists: true }],
    must_not: [{ key: "shape", match: "square" }],
  };
  const c = preselectCandidates(expr, idx);
  expect(c).toBeInstanceOf(Set);
  expect(Array.from(c ?? []).every((x) => [1, 3, 2].includes(x))).toBe(true);
});
