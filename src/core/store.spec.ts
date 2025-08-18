
/**
 * @file Tests for core store structure and behavior.
 */

import { createStore, addOrUpdate, get, updateMeta, removeById } from "./store";

test("store: add/get/update/remove", () => {
  const s = createStore<{ tag?: string }>(3, "cosine", 2);
  addOrUpdate(s, 1, new Float32Array([1, 0, 0]), { tag: "a" });
  addOrUpdate(s, 2, new Float32Array([0, 1, 0]), { tag: "b" });
  const g1 = get(s, 1);
  expect(g1?.meta?.tag).toBe("a");
  updateMeta(s, 2, { tag: "b2" });
  expect(get(s, 2)?.meta?.tag).toBe("b2");
  const rm = removeById(s, 1);
  expect(rm).not.toBeNull();
  expect(get(s, 1)).toBeNull();
});

test("store: cosine normalization on addOrUpdate", () => {
  const s = createStore<null>(3, "cosine", 1);
  addOrUpdate(s, 1, new Float32Array([3, 0, 0]), null);
  const g = get(s, 1)!;
  expect(Math.abs(g.vector[0] - 1) < 1e-6).toBeTruthy();
});
/**
 * @file Tests for core store structure and behavior.
 */
