/**
 * @file Tests for bitmap attribute strategy.
 */

import { createBitmapIndex } from "./bitmap";

test("bitmap strategy: eq/exists work; range unsupported", () => {
  const idx = createBitmapIndex();
  idx.setAttrs(10, { tag: ["a", "b"] });
  idx.setAttrs(11, { tag: ["b"] });
  idx.setAttrs(12, { flag: true });
  expect(Array.from(idx.eq("tag", "a") ?? [])).toEqual([10]);
  expect(Array.from(idx.eq("tag", "b") ?? [])).toEqual([10, 11]);
  expect(Array.from(idx.exists("flag") ?? [])).toEqual([12]);
  expect(idx.range("price", { gte: 0, lt: 100 })).toBeNull();
});
/**
 * @file Tests for bitmap attribute strategy.
 */
