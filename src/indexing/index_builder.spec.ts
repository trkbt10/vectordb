/**
 * @file Tests for index builder (writeIndexFile + writePlacementManifest)
 */

import { writeIndexFile, writePlacementManifest } from "./index_builder";
import { createMemoryFileIO } from "../persist/memory";
import { createState } from "../attr/vectorlite/create";
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
});
