/**
 * @file Unit tests for Write-Ahead Log (WAL) functionality
 */
import { getOne, getMeta, search } from "./attr/ops/core";
import { createState } from "./attr/state/create";
import { encodeWal, applyWal, applyWalWithIndex, decodeWal, type WalRecord } from "./wal";
import { createAttrIndex } from "./attr/index";

test("WAL encode/apply upsert/remove works", () => {
  const db = createState<{ tag?: string }>({ dim: 2 });
  const recs: WalRecord[] = [
    { type: "upsert", id: 42, vector: new Float32Array([1, 0]), meta: { tag: "x" } },
    { type: "setMeta", id: 42, meta: { tag: "y" } },
  ];
  const wal = encodeWal(recs);
  applyWal(db, wal);
  const r1 = getOne(db, 42);
  expect(r1?.meta).toEqual({ tag: "y" });
  // remove
  const wal2 = encodeWal([{ type: "remove", id: 42 }]);
  applyWal(db, wal2);
  expect(getOne(db, 42)).toBeNull();
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

  const db = createState<{ tag?: string }>({ dim: 3, metric: "cosine" });
  applyWal(db, merged);

  expect(getMeta(db, 1)).toEqual({ tag: "alpha2" });
  expect(getMeta(db, 2)).toBeNull();
});

test("decodeWal throws on malformed upsert with missing vector bytes", () => {
  const bad = encodeWal([{ type: "upsert", id: 7, vector: new Float32Array(0), meta: null }]);
  // Manually ensure vecLen is 0 (encodeWal already sets it based on vector length)
  expect(() => decodeWal(bad)).toThrow(/unknown type or missing vector/);
});

test("applyWalWithIndex keeps attribute index in sync", () => {
  const db = createState<{ tag?: string; price?: number }>({ dim: 2 });
  const idx = createAttrIndex();
  const projector = (m: { tag?: string; price?: number } | null) => (m ? { tag: m.tag ?? null, price: m.price ?? null } : null);

  // upsert then setMeta then remove
  const wal = encodeWal([
    { type: "upsert", id: 1, vector: new Float32Array([1, 0]), meta: { tag: "a", price: 10 } },
    { type: "setMeta", id: 1, meta: { tag: "b", price: 20 } },
  ]);
  applyWalWithIndex(db, wal, idx, projector);
  expect(idx.getAttrs(1)).toEqual({ tag: "b", price: 20 });

  const wal2 = encodeWal([{ type: "remove", id: 1 }]);
  applyWalWithIndex(db, wal2, idx, projector);
  expect(idx.getAttrs(1)).toBeNull();
});
