/**
 * @file Tests for core store structure and behavior.
 */

import {
  createStore,
  addOrUpdate,
  get,
  updateMeta,
  removeById,
  shrinkToFit,
  resizeCapacity,
  writeVectorAt,
} from "./store";

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

test("store: shrinkToFit and resizeCapacity behaviors", () => {
  const s = createStore<null>(2, "cosine", 4);
  // simulate 3 items
  s.pos.set(1, 0);
  s.ids[0] = 1;
  writeVectorAt(s, 0, new Float32Array([1, 0]));
  s.pos.set(2, 1);
  s.ids[1] = 2;
  writeVectorAt(s, 1, new Float32Array([1, 0]));
  s.pos.set(3, 2);
  s.ids[2] = 3;
  writeVectorAt(s, 2, new Float32Array([1, 0]));
  s._count = 3;
  shrinkToFit(s);
  expect(s._capacity).toBe(3);
  resizeCapacity(s, 8);
  expect(s._capacity).toBe(8);
  // cannot shrink below count -> becomes 3
  resizeCapacity(s, 2);
  expect(s._capacity).toBe(3);
});
