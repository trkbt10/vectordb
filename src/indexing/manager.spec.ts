/**
 * @file Integration test for indexing manager (save/open)
 */
import { createVectorLiteState } from "../vectorlite/create";
import { saveIndexing, openIndexing } from "./manager";
import type { CrushMap } from "./types";
import { createMemoryFileIO } from "../persist/memory";

describe("indexing/manager", () => {
  it("saves to segments and opens via index + CRUSH", async () => {
    const vl = createVectorLiteState<{ tag?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
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
});
