/**
 * @file Tests for basic attribute strategy.
 */

import { createBasicIndex } from "./basic";

test("basic strategy: eq/exists/range behave", () => {
  const idx = createBasicIndex();
  idx.setAttrs(1, { color: "red", price: 10 });
  idx.setAttrs(2, { color: "blue", price: 20 });
  idx.setAttrs(3, { color: "red", price: 15 });
  expect(Array.from(idx.eq("color", "red") ?? [])).toEqual([1, 3]);
  expect(Array.from(idx.exists("price") ?? [])).toEqual([1, 2, 3]);
  const r = idx.range("price", { gte: 10, lt: 20 });
  expect(Array.from(r ?? [])).toEqual([1, 3]);
});
