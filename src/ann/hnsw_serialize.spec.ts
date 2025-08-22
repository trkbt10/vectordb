/**
 * @file Tests for HNSW serialize/deserialize and control paths
 */
import { createState } from "../attr/state/create";
import { add, remove } from "../attr/ops/core";
import { hnsw_search, hnsw_serialize, hnsw_deserialize } from "./hnsw";
import type { HNSWState } from "./hnsw";
import { isHnswVL } from "../util/guards";

describe("ann/hnsw serialize/deserialize + controls", () => {
  it("roundtrips graph structure and hits adaptive/seeds paths", () => {
    const dim = 3;
    const db = createState<{ t?: string }>({
      dim,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 4, efConstruction: 16, efSearch: 8, seed: 42, allowReplaceDeleted: true },
    });
    // add a small cluster
    add(db, 1, new Float32Array([1, 0, 0]), null);
    add(db, 2, new Float32Array([0.95, 0.05, 0]), null);
    add(db, 3, new Float32Array([0, 1, 0]), null);
    add(db, 4, new Float32Array([0, 0.9, 0]), null);
    add(db, 5, new Float32Array([0.1, 0.1, 0.98]), null);
    // exercise remove with allowReplaceDeleted branch
    remove(db, 4);

    // search with mask + adaptiveEf + random seed strategyを通す（ガードで型を絞る）
    if (!isHnswVL(db)) {
      throw new Error("expected hnsw VL");
    }
    const mask = new Set([1, 2, 3, 5]);
    const q = new Float32Array([1, 0, 0]);
    const hitsCtl = hnsw_search(db.ann as HNSWState, db.store, q, {
      k: 2,
      control: {
        mode: "soft",
        mask,
        seeds: "auto",
        seedStrategy: "random",
        bridgeBudget: 1,
        adaptiveEf: { base: 1, min: 1, max: 4 },
        earlyStop: { margin: 0.01 },
      },
    });
    expect(hitsCtl.length).toBeGreaterThan(0);
    // also hit hard-mode disallow path
    const hitsHard = hnsw_search(db.ann as HNSWState, db.store, q, {
      k: 2,
      control: { mode: "hard", mask: new Set([3]) },
    });
    expect(Array.isArray(hitsHard)).toBe(true);
    // hit topFreq seed strategy path
    const topFreq = hnsw_search(db.ann as HNSWState, db.store, q, {
      k: 2,
      control: { mask: new Set([1, 2, 3]), seeds: 2, seedStrategy: "topFreq" },
    });
    expect(topFreq.length).toBeGreaterThan(0);

    // serialize current graph
    const buf = hnsw_serialize(db.ann as HNSWState, db.store);

    // prepare destination with same number of items
    const db2 = createState<{ t?: string }>({ dim, metric: "cosine", strategy: "hnsw", hnsw: { M: 4 } });
    add(db2, 1, new Float32Array([1, 0, 0]), null);
    add(db2, 2, new Float32Array([0.95, 0.05, 0]), null);
    add(db2, 3, new Float32Array([0, 1, 0]), null);
    // apply deserialize and ensure links populated
    if (!isHnswVL(db2)) {
      throw new Error("expected hnsw VL db2");
    }
    hnsw_deserialize(db2.ann as HNSWState, db2.store, buf);
    const again = hnsw_search(db2.ann as HNSWState, db2.store, q, { k: 2 });
    expect(again.length).toBeGreaterThan(0);
  });
});
