import { createVectorLiteState, deserializeVectorLite, add, search, serialize } from "./vectorlite";
import type { SearchHit } from './types'

test("VectorLite bruteforce: adds, searches, roundtrips", () => {
  const db = createVectorLiteState<{ tag: string }>({ dim: 3, metric: "cosine" });
  add(db, 1, new Float32Array([1, 0, 0]), { tag: "A" });
  add(db, 2, new Float32Array([0.9, 0, 0]), { tag: "B" });
  const hits = search(db, new Float32Array([0.95, 0, 0]), { k: 2 });
  expect(hits.length).toBe(2);
  const ids = hits.map((h: SearchHit<{ tag: string }>) => h.id).sort((a: number, b: number) => a - b);
  expect(ids).toEqual([1, 2]);

  const buf = serialize(db);
  const db2 = deserializeVectorLite<{ tag: string }>(buf);
  const hits2 = search(db2, new Float32Array([0.95, 0, 0]), { k: 2 });
  const ids2 = hits2.map((h: SearchHit<{ tag: string }>) => h.id).sort((a: number, b: number) => a - b);
  expect(ids2).toEqual([1, 2]);
});
