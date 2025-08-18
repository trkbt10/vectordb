import { createVectorLite, get, getMeta, search } from "./vectorlite";
import { encodeWal, applyWal, type WalRecord } from "./wal";

test("WAL encode/apply upsert/remove works", () => {
  const db = createVectorLite<{ tag?: string }>({ dim: 2 });
  const recs: WalRecord[] = [
    { type: "upsert", id: 42, vector: new Float32Array([1, 0]), meta: { tag: "x" } },
    { type: "setMeta", id: 42, meta: { tag: "y" } },
  ];
  const wal = encodeWal(recs);
  applyWal(db, wal);
  const r1 = get(db, 42);
  expect(r1?.meta).toEqual({ tag: "y" });
  // remove
  const wal2 = encodeWal([{ type: "remove", id: 42 }]);
  applyWal(db, wal2);
  expect(get(db, 42)).toBeNull();
  // sanity: add a neighbor and search
  applyWal(db, encodeWal([{ type: "upsert", id: 1, vector: new Float32Array([1, 0]), meta: null }]));
  const hit = search(db, new Float32Array([1, 0]), { k: 1 })[0];
  expect(hit.id).toBe(1);
});

test("decodeWal handles concatenated WAL segments", () => {
  const wal1 = encodeWal([{ type: "upsert", id: 1, vector: new Float32Array([1, 0, 0]), meta: { tag: "alpha" } }]);
  const wal2 = encodeWal([
    { type: "upsert", id: 2, vector: new Float32Array([0.9, 0, 0]), meta: { tag: "beta" } },
    { type: "setMeta", id: 1, meta: { tag: "alpha2" } },
  ]);
  const wal3 = encodeWal([{ type: "remove", id: 2 }]);
  const merged = new Uint8Array(wal1.length + wal2.length + wal3.length);
  merged.set(wal1, 0);
  merged.set(wal2, wal1.length);
  merged.set(wal3, wal1.length + wal2.length);

  const db = createVectorLite<{ tag?: string }>({ dim: 3, metric: "cosine" });
  applyWal(db, merged);

  expect(getMeta(db, 1)).toEqual({ tag: "alpha2" });
  expect(getMeta(db, 2)).toBeNull();
});
