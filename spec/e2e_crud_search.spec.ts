/**
 * @file E2E: CRUD + search + filter + persist/open roundtrip (with new local helper)
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { connect } from "../src/client/index";
import { createNodeFileIO } from "../src/storage/node";

describe("indexing/e2e CRUD + search", () => {
  it("performs CRUD and search with filter, then persists and opens back", async () => {
    const base = await mkdtemp(joinPath(tmpdir(), "vlite-e2e-"));
    const indexIO = createNodeFileIO(joinPath(base, ".vlindex"));
    const dataIO = (key: string) => createNodeFileIO(joinPath(base, "data", key));
    const db = await connect<{ tag?: string }>({
      storage: { index: indexIO, data: dataIO },
      database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
      index: { shards: 1, pgs: 16, segmented: true, segmentBytes: 1 << 15, includeAnn: false },
    });
    // Create
    await db.set(1, { vector: new Float32Array([1, 0, 0]), meta: { tag: "a" } });
    await db.set(2, { vector: new Float32Array([0, 1, 0]), meta: { tag: "b" } });
    await db.set(3, { vector: new Float32Array([0, 0, 1]), meta: null });
    expect(await db.has(2)).toBe(true);
    // Read
    const r2 = await db.get(2);
    expect(r2?.meta).toEqual({ tag: "b" });
    // Update meta
    const r3 = await db.get(3);
    expect(r3).not.toBeNull();
    if (r3) {
      await db.set(3, { vector: r3.vector, meta: { tag: "c" } }, { upsert: true });
    }
    expect((await db.get(3))?.meta).toEqual({ tag: "c" });
    // Search
    const hits = await db.findMany(new Float32Array([1, 0, 0]), { k: 2 });
    expect(hits.length).toBe(2);
    // Filtered search (exclude tag b)
    const filtered = await db.findMany(new Float32Array([0, 1, 0]), {
      k: 3,
      filter: (_id: number, meta: { tag?: string } | null) => meta?.tag !== "b",
    });
    expect(filtered.find((h: { id: number }) => h.id === 2)).toBeUndefined();
    // Remove
    const rm = await db.delete(1);
    expect(rm).toBe(true);
    expect(await db.has(1)).toBe(false);

    // Persist via local helper
    await db.index.saveState(db.state, { baseName: "db" });

    // Open back
    const db2 = await connect<{ tag?: string }>({
      storage: { index: indexIO, data: dataIO },
      index: { name: "db", shards: 1, pgs: 16, segmented: true, segmentBytes: 1 << 15, includeAnn: false },
      onMissing: async ({ index }) => index.openState({ baseName: "db" }),
    });
    // internal count not directly exposed on client; check via get/search
    expect((await db2.get(3))?.meta).toEqual({ tag: "c" });
    const hits2 = await db2.findMany(new Float32Array([0, 1, 0]), { k: 2 });
    expect(hits2.length).toBeGreaterThan(0);
  });
});
