/**
 * @file Tests for attribute subsystem.
 */

import { createAttrIndex } from "./index";

test("basic strategy: eq/exists/range behave", () => {
  const idx = createAttrIndex("basic");
  idx.setAttrs(1, { color: "red", price: 10 });
  idx.setAttrs(2, { color: "blue", price: 20 });
  idx.setAttrs(3, { color: "red", price: 15 });
  expect(Array.from(idx.eq("color", "red") ?? [])).toEqual([1, 3]);
  expect(Array.from(idx.exists("price") ?? [])).toEqual([1, 2, 3]);
  const r = idx.range("price", { gte: 10, lt: 20 });
  expect(Array.from(r ?? [])).toEqual([1, 3]);
});

test("bitmap strategy: eq/exists work; range unsupported", () => {
  const idx = createAttrIndex("bitmap");
  idx.setAttrs(10, { tag: ["a", "b"] });
  idx.setAttrs(11, { tag: ["b"] });
  idx.setAttrs(12, { flag: true });
  expect(Array.from(idx.eq("tag", "a") ?? [])).toEqual([10]);
  expect(Array.from(idx.eq("tag", "b") ?? [])).toEqual([10, 11]);
  expect(Array.from(idx.exists("flag") ?? [])).toEqual([12]);
  expect(idx.range("price", { gte: 0, lt: 100 })).toBeNull();
});

test("throws on unsupported strategy name", () => {
  // @ts-expect-error: intentionally passing invalid strategy to hit error branch
  expect(() => createAttrIndex("unknown"))
    .toThrow(/Unsupported attribute index strategy/);
});
