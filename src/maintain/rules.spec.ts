/**
 * @file Unit tests for rule-based alerts
 */
import { createState } from "../attr/state/create";
import { add, remove } from "../attr/ops/core";
import {
  registerRules,
  clearRules,
  evaluateRules,
  ruleLargeDatasetBF,
  ruleHnswLowDegree,
  ruleHnswTombstone,
  ruleIvfImbalance,
} from "./rules";

describe("rules engine", () => {
  it("emits alert for large BF dataset", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    for (let i = 0; i < 12000; i++) add(vl, i + 1, new Float32Array([1, 0]), null);
    clearRules();
    registerRules([ruleLargeDatasetBF(10000)]);
    const alerts = evaluateRules(vl);
    expect(alerts.some((a) => a.code === "bf.large-dataset")).toBe(true);
  });

  it("emits alert for HNSW tombstones", () => {
    const vl = createState({
      dim: 2,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 4, efConstruction: 50 },
    });
    for (let i = 0; i < 100; i++) add(vl, i + 1, new Float32Array([1, 0]), null);
    // delete 40% -> exceed threshold 0.3
    for (let i = 0; i < 40; i++) remove(vl, i + 1);
    clearRules();
    registerRules([ruleHnswLowDegree(0), ruleHnswTombstone(0.3)]);
    const alerts = evaluateRules(vl);
    expect(alerts.some((a) => a.code === "hnsw.tombstone-high")).toBe(true);
  });

  it("emits alert for IVF imbalance", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 3, nprobe: 1 } });
    // Seed centroids
    for (const v of [new Float32Array([1, 0]), new Float32Array([0, 1]), new Float32Array([-1, 0])]) {
      add(vl, vl.store._count + 1, v, null);
    }
    // Skew many points toward first centroid to create imbalance
    for (let i = 0; i < 20; i++) add(vl, 100 + i, new Float32Array([1, i * 1e-3]), null);
    clearRules();
    // low degree rule included but not necessary here
    registerRules([ruleHnswLowDegree(0)]);
    clearRules();
    registerRules([ruleIvfImbalance(2)]);
    const alerts = evaluateRules(vl);
    expect(alerts.some((a: { code: string }) => a.code === "ivf.imbalance")).toBe(true);
  });
});
