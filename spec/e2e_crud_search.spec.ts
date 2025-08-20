/**
 * @file E2E: CRUD + search + filter + persist/open roundtrip (with new local helper)
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { createCluster } from "../src/index";
import { createPrefixedNodeFileIO } from "../src/persist/node";

describe("indexing/e2e CRUD + search", () => {
  it("performs CRUD and search with filter, then persists and opens back", async () => {
    const base = await mkdtemp(joinPath(tmpdir(), "vlite-e2e-"));
    const indexIO = createPrefixedNodeFileIO(joinPath(base, ".vlindex"));
    const dataIO = (key: string) => createPrefixedNodeFileIO(joinPath(base, "data", key));
    const l = createCluster<{ tag?: string }>({ index: indexIO, data: dataIO }, { shards: 1, pgs: 16, segmented: true, segmentBytes: 1 << 15, includeAnn: false });

    const db = l.db.create({ dim: 3, metric: "cosine", strategy: "bruteforce" });
    // Create
    db.set(1, new Float32Array([1, 0, 0]), { tag: "a" });
    db.set(2, new Float32Array([0, 1, 0]), { tag: "b" });
    db.set(3, new Float32Array([0, 0, 1]), null);
    expect(db.has(2)).toBe(true);
    // Read
    const r2 = db.get(2);
    expect(r2?.meta).toEqual({ tag: "b" });
    // Update meta
    const r3 = db.get(3);
    expect(r3).not.toBeNull();
    if (r3) db.set(3, { vector: r3.vector, meta: { tag: "c" } }, undefined, { upsert: true });
    expect(db.get(3)?.meta).toEqual({ tag: "c" });
    // Search
    const hits = db.search(new Float32Array([1, 0, 0]), { k: 2 });
    expect(hits.length).toBe(2);
    // Filtered search (exclude tag b)
    const filtered = db.search(new Float32Array([0, 1, 0]), {
      k: 3,
      filter: (_id: number, meta: { tag?: string } | null) => meta?.tag !== "b",
    });
    expect(filtered.find((h) => h.id === 2)).toBeUndefined();
    // Remove
    const rm = db.delete(1);
    expect(rm).toBe(true);
    expect(db.has(1)).toBe(false);

    // Persist via local helper
    await l.index.save(db, { baseName: "db" });

    // Open back
    const state2 = await l.index.openState({ baseName: "db" });
    const db2 = l.db.from(state2);
    // internal count not directly exposed on client; check via get/search
    expect(db2.get(3)?.meta).toEqual({ tag: "c" });
    const hits2 = db2.search(new Float32Array([0, 1, 0]), { k: 2 });
    expect(hits2.length).toBeGreaterThan(0);
  });
});
