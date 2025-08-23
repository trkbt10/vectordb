/** @file Result-consistency: distributed delay tests */
import { createState } from "../../src/attr/state/create";
import { createIndexOps } from "../../src/client/indexing";
import { add } from "../../src/attr/ops/core";
import { createMemoryFileIO } from "../../src/storage/memory";
import type { FileIO } from "../../src/storage/types";

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function delayed(io: FileIO, ms: number): FileIO {
  return {
    async read(p) {
      return io.read(p);
    },
    async write(p, d) {
      await delay(ms);
      return io.write(p, d);
    },
    async append(p, d) {
      await delay(ms);
      return io.append(p, d);
    },
    async atomicWrite(p, d) {
      await delay(ms);
      return io.atomicWrite(p, d);
    },
    async del(p) {
      return io.del?.(p) as Promise<void>;
    },
  };
}

describe("result-consistency: distributed delay across data targets", () => {
  it("saves after all data targets complete and opens full snapshot", async () => {
    const indexIO = createMemoryFileIO();
    const dataIOs: Record<string, FileIO> = {
      "0": delayed(createMemoryFileIO(), 20),
      "1": delayed(createMemoryFileIO(), 0),
    };
    const ops = createIndexOps<{ tag?: string }>(
      {
        index: indexIO,
        data: (ns: string) => dataIOs[ns] ?? dataIOs["0"],
      },
      { shards: 2, replicas: 1, pgs: 8, segmented: true },
    );

    const st = createState<{ tag?: string }>({ dim: 3, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 10; i++) {
      add(st, i + 1, new Float32Array([i, 0, 0]), { tag: `m${i}` }, { upsert: true });
    }

    await ops.saveState(st, { baseName: "db" });
    const opened = await ops.openState({ baseName: "db" });
    expect(opened.store._count).toBe(10);
    const i1 = opened.store.pos.get(1)!;
    const i10 = opened.store.pos.get(10)!;
    expect(opened.store.metas[i1]?.tag).toBe("m0");
    expect(opened.store.metas[i10]?.tag).toBe("m9");
  });
});
