/**
 * @file Rebalance plan/apply test: change crushmap and relocate segments
 */
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { createState } from "../../attr/state/create";
import { persistIndex, openFromIndex } from "../../attr/ops/index_persist";
import { createNodeFileIO } from "../../storage/node";
import { planRebalance, applyRebalance } from "./rebalance";

describe("indexing/rebalance", () => {
  it("moves segments to satisfy new crushmap and opens with updated placement", async () => {
    const base = await mkdtemp(joinPath(tmpdir(), "vlite-rebal-"));
    const makeEnv = (shards: number, pgs: number) => {
      const targets = Array.from({ length: Math.max(1, shards | 0) }, (_, i) => ({ key: String(i) }));
      const crush = { pgs: Math.max(1, pgs | 0), replicas: 1, targets } as const;
      const resolveDataIO = (key: string) => createNodeFileIO(joinPath(base, "data", key));
      const resolveIndexIO = () => createNodeFileIO(joinPath(base, ".vlindex"));
      return { crush, resolveDataIO, resolveIndexIO };
    };
    const env = makeEnv(2, 16);
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 10; i++) {
      vl.store.ids[i] = i + 1;
      vl.store.data.set(new Float32Array([i, i + 1]), i * 2);
      vl.store.metas[i] = null;
      vl.store.pos.set(i + 1, i);
      vl.store._count = i + 1;
    }
    await persistIndex(vl, {
      baseName: "db",
      crush: env.crush,
      resolveDataIO: env.resolveDataIO,
      resolveIndexIO: env.resolveIndexIO,
      segmented: true,
      segmentBytes: 1 << 15,
    });

    // New crush with more shards
    const env2 = makeEnv(4, 16);
    const manifestIo = env.resolveIndexIO();
    const mbytes = await manifestIo.read("db.manifest.json");
    const manifest = JSON.parse(new TextDecoder().decode(mbytes)) as {
      segments: { name: string; targetKey: string }[];
    };
    const plan = planRebalance(manifest, env2.crush);
    // Apply moves with verification and cleanup (delete old files)
    await applyRebalance("db", plan, {
      resolveDataIO: env2.resolveDataIO,
      resolveIndexIO: env2.resolveIndexIO,
      verify: true,
      cleanup: true,
    });

    // Ensure at least one planned source no longer has the file
    if (plan.length > 0) {
      const first = plan[0];
      // eslint-disable-next-line no-restricted-syntax -- Test: tracking deletion status
      let deleted = false;
      try {
        await env.resolveDataIO(first.from).read(`${first.name}.data`);
      } catch {
        deleted = true;
      }
      expect(deleted).toBeTruthy();
    }

    // Verify some .data exist under new shard dirs
    const dataRoot = joinPath(base, "data");
    const shards = await readdir(dataRoot);
    let files = 0; // eslint-disable-line no-restricted-syntax -- accumulation in test
    for (const sh of shards) {
      const entries = await readdir(joinPath(dataRoot, sh));
      files += entries.filter((n) => n.endsWith(".data")).length;
    }
    expect(files).toBeGreaterThan(0);

    // Open with new crush
    const vl2 = await openFromIndex({
      baseName: "db",
      crush: env2.crush,
      resolveDataIO: env2.resolveDataIO,
      resolveIndexIO: env2.resolveIndexIO,
    });
    expect(vl2.store._count).toBe(10);
  });
});
