/**
 * @file Tests for index builder (writeIndexFile + writePlacementManifest)
 */

import { writeIndexFile, writePlacementManifest } from "./index_builder";
import { createMemoryFileIO } from "../storage/memory";
import { createState } from "../attr/state/create";
import { decodeIndexFile } from "./formats/index_file";

describe("indexing/index_builder", () => {
  it("writes index and manifest files readable from index IO", async () => {
    const io = createMemoryFileIO();
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    const entries = [
      { id: 1, ptr: { segment: "db.pg0.part0", offset: 8, length: 24 } },
      { id: 2, ptr: { segment: "db.pg1.part0", offset: 32, length: 24 } },
    ];
    await writePlacementManifest(
      "db",
      { segments: entries.map((e) => ({ name: e.ptr.segment, targetKey: "X" })) },
      { resolveIndexIO: () => io },
    );
    await writeIndexFile(vl, entries, { baseName: "db", resolveIndexIO: () => io, includeAnn: false });
    const idxBytes = await io.read("db.index");
    const dec = decodeIndexFile(idxBytes);
    expect(dec.entries.length).toBe(2);
    const manBytes = await io.read("db.manifest.json");
    const man = JSON.parse(new TextDecoder().decode(manBytes));
    expect(man.segments.length).toBe(2);
  });

  it("includes IVF ANN bytes when includeAnn=true", async () => {
    const io = createMemoryFileIO();
    const vl = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 2, nprobe: 1 } });
    // Seed a couple rows so ANN serialization is non-empty
    vl.store.ids[0] = 1;
    vl.store.data.set(new Float32Array([1, 0]), 0);
    vl.store.metas[0] = null;
    vl.store.pos.set(1, 0);
    vl.store._count = 1;
    const entries = [{ id: 1, ptr: { segment: "db.pg0.part0", offset: 8, length: 24 } }];
    await writeIndexFile(vl, entries, { baseName: "dbivf", resolveIndexIO: () => io, includeAnn: true });
    const idxBytes = await io.read("dbivf.index");
    const dec = decodeIndexFile(idxBytes);
    expect(dec.header.hasAnn).toBe(true);
    expect(dec.ann && dec.ann.length >= 0).toBeTruthy();
  });
});
