/** @file Result-consistency: time-based bounded-staleness selection via HEAD */
import { createMemoryFileIO } from "../../src/storage/memory";
import { DataSegmentWriter } from "../../src/indexing/formats/data_segment";
import { encodeIndexFile } from "../../src/indexing/formats/index_file";
import { encodeMetric, encodeStrategy } from "../../src/constants/format";
import { openIndexing } from "../../src/indexing/runtime/manager";

describe("result-consistency: time-based bounded staleness (HEAD vs default manifest)", () => {
  it("uses HEAD manifest when readable at now-epsilon; otherwise falls back to default manifest", async () => {
    const indexIO = createMemoryFileIO();
    const dataA = createMemoryFileIO();
    const dataB = createMemoryFileIO();

    const segName = "seg.pg0.part0.0";
    const writerA = new DataSegmentWriter(segName);
    const pA = writerA.append({ id: 1, meta: { src: "A" }, vector: new Float32Array([1, 0]) });
    await writerA.writeAtomic(dataA, `${segName}.data`);
    const writerB = new DataSegmentWriter(segName);
    const pB = writerB.append({ id: 1, meta: { src: "B" }, vector: new Float32Array([0, 1]) });
    await writerB.writeAtomic(dataB, `${segName}.data`);

    // Pointers must match (same row layout)
    expect(pA.offset).toBe(pB.offset);
    expect(pA.length).toBe(pB.length);

    const idxBytes = encodeIndexFile(
      { metricCode: encodeMetric("cosine"), dim: 2, count: 1, strategyCode: encodeStrategy("bruteforce"), hasAnn: false },
      [{ id: 1, ptr: { segment: segName, offset: pA.offset, length: pA.length } }],
    );
    await indexIO.atomicWrite("db.index", idxBytes);

    // Default manifest points to A
    await indexIO.atomicWrite(
      "db.manifest.json",
      new TextEncoder().encode(JSON.stringify({ segments: [{ name: segName, targetKey: "A" }] })),
    );
    // Alternate manifest points to B
    await indexIO.atomicWrite(
      "db.alt.manifest.json",
      new TextEncoder().encode(JSON.stringify({ segments: [{ name: segName, targetKey: "B" }] })),
    );

    const resolveDataIO = (k: string) => (k === "B" ? dataB : dataA);
    const resolveIndexIO = () => indexIO;

    // Case 1: HEAD is readable (commitTs in the past) -> use alt manifest (B)
    await indexIO.atomicWrite(
      "db.head.json",
      new TextEncoder().encode(JSON.stringify({ manifest: "db.alt.manifest.json", epoch: 1, commitTs: 0 })),
    );
    const vl1 = await openIndexing<{ src: string }>({
      baseName: "db",
      crush: { pgs: 1, replicas: 1, targets: [{ key: "A" }, { key: "B" }] },
      resolveDataIO,
      resolveIndexIO,
    });
    const i1 = vl1.store.pos.get(1)!;
    expect(vl1.store.metas[i1]).toEqual({ src: "B" });

    // Case 2: HEAD is not yet readable (commitTs in the future) -> fallback to default manifest (A)
    const future = Date.now() + 60_000;
    await indexIO.atomicWrite(
      "db.head.json",
      new TextEncoder().encode(JSON.stringify({ manifest: "db.alt.manifest.json", epoch: 2, commitTs: future })),
    );
    const vl2 = await openIndexing<{ src: string }>({
      baseName: "db",
      crush: { pgs: 1, replicas: 1, targets: [{ key: "A" }, { key: "B" }] },
      resolveDataIO,
      resolveIndexIO,
    });
    const i2 = vl2.store.pos.get(1)!;
    expect(vl2.store.metas[i2]).toEqual({ src: "A" });
  });
});

