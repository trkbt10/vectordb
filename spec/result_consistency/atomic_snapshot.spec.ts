/** @file Result-consistency: atomic snapshot commit tests */
import { createState } from "../../src/attr/state/create";
import { createIndexOps } from "../../src/client/indexing";
import { add } from "../../src/attr/ops/core";
import { createMemoryFileIO } from "../../src/storage/memory";
import type { FileIO } from "../../src/storage/types";

function faultyIndexIO(base: FileIO, failOnceOnSuffix: string): FileIO {
  const failedRef = { v: false };
  return {
    async read(p) {
      return base.read(p);
    },
    async write(p, d) {
      if (!failedRef.v && p.endsWith(failOnceOnSuffix)) {
        failedRef.v = true;
        throw new Error("injected failure");
      }
      return base.write(p, d);
    },
    async append(p, d) {
      return base.append(p, d);
    },
    async atomicWrite(p, d) {
      if (!failedRef.v && p.endsWith(failOnceOnSuffix)) {
        failedRef.v = true;
        throw new Error("injected failure");
      }
      return base.atomicWrite(p, d);
    },
    async del(p) {
      return base.del?.(p) as Promise<void>;
    },
  };
}

describe("result-consistency: atomic snapshot commit (manifest+catalog before index)", () => {
  it("rebuilds from data when index write fails once", async () => {
    const indexBase = createMemoryFileIO();
    const dataBase = createMemoryFileIO();
    const idxIO = faultyIndexIO(indexBase, ".index");
    const ops = createIndexOps<{ tag?: string }>(
      {
        index: idxIO,
        data: () => dataBase,
      },
      { shards: 2, replicas: 1, pgs: 8, segmented: true },
    );

    const st = createState<{ tag?: string }>({ dim: 3, metric: "cosine", strategy: "bruteforce" });
    add(st, 1, new Float32Array([1, 0, 0]), { tag: "a" }, { upsert: true });
    add(st, 2, new Float32Array([0, 1, 0]), { tag: "b" }, { upsert: true });

    await expect(ops.saveState(st, { baseName: "db" })).rejects.toThrow(/injected failure/);

    const opened = await ops.openState({ baseName: "db" });
    expect(opened.store._count).toBe(2);
    const i1 = opened.store.pos.get(1)!;
    const i2 = opened.store.pos.get(2)!;
    expect(opened.store.metas[i1]?.tag).toBe("a");
    expect(opened.store.metas[i2]?.tag).toBe("b");
  });
});
