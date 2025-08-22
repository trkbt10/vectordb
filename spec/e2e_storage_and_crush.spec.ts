/**
 * @file e2e: storage separation and CRUSH placement
 * Why: assert that index/data paths are respected and placement remains correct across open/save cycles.
 */
// use test globals from runner
import { connect } from "../src/index";
import type { FileIO } from "../src/storage/types";

function createRecordingIO(initial?: Record<string, Uint8Array | ArrayBuffer>) {
  const store = new Map<string, Uint8Array>();
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      store.set(k, v instanceof Uint8Array ? v : new Uint8Array(v));
    }
  }
  const writes = new Set<string>();
  const reads = new Set<string>();
  const io: FileIO = {
    async read(path: string) {
      reads.add(path);
      const v = store.get(path);
      if (!v) {
        throw new Error(`not found: ${path}`);
      }
      return new Uint8Array(v);
    },
    async write(path: string, data: Uint8Array | ArrayBuffer) {
      writes.add(path);
      store.set(path, data instanceof Uint8Array ? data : new Uint8Array(data));
    },
    async append(path: string, data: Uint8Array | ArrayBuffer) {
      writes.add(path);
      const prev = store.get(path);
      const next = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (!prev) {
        store.set(path, next);
        return;
      }
      const merged = new Uint8Array(prev.length + next.length);
      merged.set(prev, 0);
      merged.set(next, prev.length);
      store.set(path, merged);
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer) {
      writes.add(path);
      store.set(path, data instanceof Uint8Array ? data : new Uint8Array(data));
    },
    async del(path: string) {
      store.delete(path);
    },
  };
  return { io, store, writes, reads };
}

function makeVec(dim: number, seed: number) {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    v[i] = ((seed + i * 13) % 100) / 100;
  }
  return v;
}

describe("e2e/index-data separated storage and CRUSH placement", () => {
  it("search works even when index file is missing (triggers rebuild)", async () => {
    const indexFS = createRecordingIO();
    const dataFS = createRecordingIO();
    const c = await connect<{ tag?: string }>({
      storage: { index: indexFS.io, data: dataFS.io },
      database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
      index: { shards: 2, pgs: 8, segmented: true, includeAnn: false },
    });
    // insert a few rows
    await c.upsert(
      { id: 1, vector: makeVec(3, 1), meta: { tag: "a" } },
      { id: 2, vector: makeVec(3, 2), meta: { tag: "b" } },
      { id: 3, vector: makeVec(3, 3), meta: null },
    );
    await c.index.saveState(c.state, { baseName: "db" });

    // simulate missing index file (.index); keep catalog+manifest
    await indexFS.io.del?.("db.index");

    const c2 = await connect<{ tag?: string }>({
      storage: { index: indexFS.io, data: dataFS.io },
      index: { name: "db", shards: 2, pgs: 8, segmented: true, includeAnn: false },
      onMissing: async ({ index }) => index.openState({ baseName: "db" }),
    });
    const hits = await c2.findMany(makeVec(3, 1), { k: 2 });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("separated storages: index writes go to indexFS; data segments go to dataFS (HNSW)", async () => {
    const indexFS = createRecordingIO();
    const dataFS = createRecordingIO();
    const clientB = await connect<{ tag?: string }>({
      storage: { index: indexFS.io, data: dataFS.io },
      database: { dim: 3, metric: "cosine", strategy: "hnsw" },
      index: { shards: 2, pgs: 8, segmented: true, includeAnn: true },
    });
    const c = clientB;
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      vector: makeVec(3, i + 1),
      meta: { tag: `t${i}` },
    }));
    await c.upsert(...rows);
    await clientB.index.saveState(c.state, { baseName: "db" });

    // Expect indexFS contains index artifacts
    const indexFiles = Array.from(indexFS.writes);
    expect(indexFiles.some((p) => p.endsWith("db.index"))).toBe(true);
    expect(indexFiles.some((p) => p.endsWith("db.catalog.json"))).toBe(true);
    expect(indexFiles.some((p) => p.endsWith("db.manifest.json"))).toBe(true);

    // Expect dataFS contains data segments
    const dataFiles = Array.from(dataFS.writes).filter((p) => p.endsWith(".data"));
    expect(dataFiles.length).toBeGreaterThan(0);

    // Open and query
    const c2 = await connect<{ tag?: string }>({
      storage: { index: indexFS.io, data: dataFS.io },
      index: { name: "db", shards: 2, pgs: 8, segmented: true, includeAnn: true },
      onMissing: async ({ index }) => index.openState({ baseName: "db" }),
    });
    const out = await c2.findMany(makeVec(3, 2), { k: 3 });
    expect(out.length).toBeGreaterThan(0);
  });

  it("CRUSH placement distributes segments across target stores", async () => {
    // create N target stores and bind via data(targetKey)
    const indexFS = createRecordingIO();
    const dataTargets: Record<string, ReturnType<typeof createRecordingIO>> = {
      "0": createRecordingIO(),
      "1": createRecordingIO(),
      "2": createRecordingIO(),
    };
    const clientC = await connect<{ tag?: string }>({
      storage: {
        index: indexFS.io,
        data: (key: string) => (dataTargets[key] ? dataTargets[key]!.io : dataTargets["0"].io),
      },
      database: { dim: 4, metric: "cosine", strategy: "bruteforce" },
      index: { shards: 3, pgs: 12, segmented: true, includeAnn: false },
    });

    const c = clientC;
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      vector: makeVec(4, i + 1),
      meta: { tag: `t${i}` },
    }));
    await c.upsert(...rows);
    await clientC.index.saveState(c.state, { baseName: "db" });

    const counts: Record<string, number> = {};
    for (const [k, rec] of Object.entries(dataTargets)) {
      counts[k] = Array.from(rec.writes).filter((p) => p.endsWith(".data")).length;
    }

    const usedKeys = Object.entries(counts)
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([k]) => k);
    // Expect distribution to use at least 2 distinct targets
    expect(usedKeys.length).toBeGreaterThanOrEqual(2);
  });
});
