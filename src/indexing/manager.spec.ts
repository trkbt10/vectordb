/**
 * @file Integration test for indexing manager (save/open)
 */
import { createState } from "../attr/state/create";
import { saveIndexing, openIndexing } from "./runtime/manager";
import type { CrushMap } from "./types";
import { createMemoryFileIO } from "../storage/memory";
import { DataSegmentWriter } from "./formats/data_segment";
import { encodeIndexFile } from "./formats/index_file";
import { encodeMetric, encodeStrategy } from "../constants/format";

describe("indexing/manager", () => {
  it("saves to segments and opens via index + CRUSH", async () => {
    const vl = createState<{ tag?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    // add three rows
    vl.store.ids[0] = 1;
    vl.store.data.set(new Float32Array([1, 0]), 0);
    vl.store.metas[0] = { tag: "a" };
    vl.store.pos.set(1, 0);
    vl.store._count = 1;

    vl.store.ids[1] = 2;
    vl.store.data.set(new Float32Array([0, 1]), 2);
    vl.store.metas[1] = { tag: "b" };
    vl.store.pos.set(2, 1);
    vl.store._count = 2;

    vl.store.ids[2] = 3;
    vl.store.data.set(new Float32Array([0.5, 0.5]), 4);
    vl.store.metas[2] = null;
    vl.store.pos.set(3, 2);
    vl.store._count = 3;

    const crush: CrushMap = { pgs: 4, replicas: 1, targets: [{ key: "a" }, { key: "b" }] };
    const dataStores: Record<string, ReturnType<typeof createMemoryFileIO>> = {
      a: createMemoryFileIO(),
      b: createMemoryFileIO(),
    };
    const indexStore = createMemoryFileIO();

    await saveIndexing(vl, {
      baseName: "dbx",
      crush,
      resolveDataIO: (k) => dataStores[k],
      resolveIndexIO: () => indexStore,
      segmented: true,
      segmentBytes: 1 << 20,
      includeAnn: false,
    });

    const vl2 = await openIndexing<{ tag?: string }>({
      baseName: "dbx",
      crush,
      resolveDataIO: (k) => dataStores[k],
      resolveIndexIO: () => indexStore,
      rebuildIfNeeded: true,
    });

    expect(vl2.dim).toBe(2);
    expect(vl2.store._count).toBe(3);
    // ids preserved
    expect(Array.from(vl2.store.ids.subarray(0, 3))).toEqual([1, 2, 3]);
    // metas preserved
    expect(vl2.store.metas[0]).toEqual({ tag: "a" });
    expect(vl2.store.metas[1]).toEqual({ tag: "b" });
    expect(vl2.store.metas[2]).toBeNull();
  });

  it("openIndexing rebuilds IVF ANN when index has no ANN payload", async () => {
    const indexIO = createMemoryFileIO();
    const dataIO = createMemoryFileIO();
    // Prepare a data segment with two rows
    const segName = "idx.pg0.part0";
    const writer = new DataSegmentWriter(segName);
    writer.append({ id: 1, meta: null, vector: new Float32Array([1, 0]) });
    writer.append({ id: 2, meta: null, vector: new Float32Array([0, 1]) });
    await writer.writeAtomic(dataIO, `${segName}.data`);
    // Write index without ANN (hasAnn=false)
    const header = {
      metricCode: encodeMetric("cosine"),
      dim: 2,
      count: 2,
      strategyCode: encodeStrategy("ivf"),
      hasAnn: false,
    };
    // Build proper entry pointers from writer output
    const buf = writer.concat();
    // Decode rows back to compute exact lengths
    // first row starts at 8
    const dv1 = new DataView(buf.buffer);
    const metaLen1 = dv1.getUint32(8 + 4, true);
    const vecLen1 = dv1.getUint32(8 + 8, true);
    const len1 = 12 + metaLen1 + vecLen1;
    const off2 = 8 + len1;
    const metaLen2 = dv1.getUint32(off2 + 4, true);
    const vecLen2 = dv1.getUint32(off2 + 8, true);
    const len2 = 12 + metaLen2 + vecLen2;
    const entries2 = [
      { id: 1, ptr: { segment: segName, offset: 8, length: len1 } },
      { id: 2, ptr: { segment: segName, offset: off2, length: len2 } },
    ];
    const idxBytes = encodeIndexFile(header, entries2);
    await indexIO.atomicWrite("dbi.index", idxBytes);

    const crush: CrushMap = { pgs: 1, replicas: 1, targets: [{ key: "mem" }] };
    const vl = await openIndexing({
      baseName: "dbi",
      crush,
      resolveIndexIO: () => indexIO,
      resolveDataIO: () => dataIO,
      rebuildIfNeeded: true,
    });
    expect(vl.strategy).toBe("ivf");
    expect(vl.store._count).toBe(2);
  });

  it("rebuildIndexingFromData grows capacity when rows exceed initial", async () => {
    const indexIO = createMemoryFileIO();
    const dataIO = createMemoryFileIO();
    const baseName = "big";
    // Create one segment with >1024 rows
    const segName = `${baseName}.pg0.part0`;
    const writer = new DataSegmentWriter(segName);
    const N = 1026;
    for (let i = 0; i < N; i++) {
      writer.append({ id: i + 1, meta: null, vector: new Float32Array([1, 0]) });
    }
    await writer.writeAtomic(dataIO, `${segName}.data`);
    // Write manifest and catalog
    const man = { base: baseName, segments: [{ name: segName, targetKey: "mem" }] };
    await indexIO.atomicWrite(`${baseName}.manifest.json`, new TextEncoder().encode(JSON.stringify(man)));
    const cat = { version: 1, dim: 2, metricCode: encodeMetric("cosine"), strategyCode: encodeStrategy("bruteforce") };
    await indexIO.atomicWrite(`${baseName}.catalog.json`, new TextEncoder().encode(JSON.stringify(cat)));

    const crush: CrushMap = { pgs: 1, replicas: 1, targets: [{ key: "mem" }] };
    const vl = await openIndexing({
      baseName,
      crush,
      resolveIndexIO: () => indexIO,
      resolveDataIO: () => dataIO,
      rebuildIfNeeded: true,
    });
    expect(vl.store._count).toBe(N);
    expect(vl.store._capacity).toBeGreaterThan(1024);
    expect(vl.store._capacity).toBeGreaterThanOrEqual(N);
  });
});
