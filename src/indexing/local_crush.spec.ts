/**
 * @file Local CRUSH env integration: verifies directory-sharded persistence
 */

import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { createVectorLiteState } from "../attr/vectorlite/create";
import { persistIndex, openFromIndex } from "../attr/vectorlite/ops/index_persist";
import { createLocalCrushEnv } from "./helpers/local_crush";

describe("indexing/local_crush", () => {
  it("saves segments across shard directories and opens back", async () => {
    const base = await mkdtemp(joinPath(tmpdir(), "vlite-crush-"));
    const env = createLocalCrushEnv(base, /*shards*/ 4, /*pgs*/ 32);

    // Prepare small dataset
    const vl = createVectorLiteState<{ tag?: string }>({ dim: 3, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 20; i++) {
      vl.store.ids[i] = i + 1;
      vl.store.data.set(new Float32Array([i, i + 1, i + 2]), i * 3);
      vl.store.metas[i] = { tag: i % 2 ? "odd" : "even" };
      vl.store.pos.set(i + 1, i);
      vl.store._count = i + 1;
    }

    await persistIndex(vl, {
      baseName: "db",
      crush: env.crush,
      resolveDataIO: env.resolveDataIO,
      resolveIndexIO: env.resolveIndexIO,
      segmented: true,
      segmentBytes: 1 << 16,
      includeAnn: false,
    });

    // Verify sharded directories contain segment data files
    const dataRoot = joinPath(base, "data");
    const shards = await readdir(dataRoot);
    expect(shards.length).toBeGreaterThanOrEqual(2);
    let filesFound = 0; // eslint-disable-line no-restricted-syntax -- accumulation in test
    for (const sh of shards) {
      const entries = await readdir(joinPath(dataRoot, sh));
      filesFound += entries.filter((n) => n.endsWith(".data")).length;
    }
    expect(filesFound).toBeGreaterThan(0);

    // Open back and compare
    const vl2 = await openFromIndex<{ tag?: string }>({
      baseName: "db",
      crush: env.crush,
      resolveDataIO: env.resolveDataIO,
      resolveIndexIO: env.resolveIndexIO,
      rebuildIfNeeded: true,
    });
    expect(vl2.store._count).toBe(20);
    expect(Array.from(vl2.store.ids.subarray(0, 5))).toEqual([1, 2, 3, 4, 5]);
    expect(vl2.store.metas[0]).toEqual({ tag: "even" });
  });
});
