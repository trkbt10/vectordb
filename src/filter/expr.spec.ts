import { compilePredicate, type FilterExpr, preselectCandidates, type AttrIndexReader } from "./expr";

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
