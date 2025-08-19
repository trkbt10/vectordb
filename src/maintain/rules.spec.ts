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
});
