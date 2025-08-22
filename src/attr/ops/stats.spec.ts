/**
 * Stats/diagnose spec.
 *
 * Why: Validate fields are populated and suggestions can be produced.
 */

/**
 * @file Unit tests for statistics operations
 */
import { createState } from "../state/create";
import { add, remove } from "./core";
import { stats, diagnose } from "./stats";

describe("ops.stats", () => {
  it("stats exposes basic fields", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(vl, 1, new Float32Array([1, 0]), null);
    const s = stats(vl);
    expect(s.n).toBe(1);
    expect(s.strategy).toBe("bruteforce");
  });
  it("diagnose returns structure", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(vl, 1, new Float32Array([1, 0]), null);
    const d = diagnose(vl);
    expect(Array.isArray(d.suggestions)).toBe(true);
  });
  it("diagnose computes recallEstimate when sampleQueries provided", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(vl, 1, new Float32Array([1, 0]), null);
    add(vl, 2, new Float32Array([0.9, 0]), null);
    const d = diagnose(vl, { sampleQueries: [new Float32Array([1, 0])], k: 1 });
    expect(typeof d.recallEstimate).toBe("number");
    expect(d.recallEstimate).toBeGreaterThan(0.9); // identical search vs itself
  });
  it("diagnose flags IVF list imbalance with hotspot", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 3, nprobe: 1 } });
    // Seed initial centroids with 3 distinct heads (become centroids)
    add(vl, 1, new Float32Array([1, 0]), null);
    add(vl, 2, new Float32Array([0, 1]), null);
    add(vl, 3, new Float32Array([-1, 0]), null);
    // Now skew many points towards first centroid to create imbalance
    for (let i = 0; i < 18; i++) {
      add(vl, 10 + i, new Float32Array([1, i * 1e-3]), null);
    }

    // A few points for others
    add(vl, 100, new Float32Array([0, 1]), null);
    add(vl, 101, new Float32Array([-1, 0]), null);
    const d = diagnose(vl);
    expect(d.suggestions.some((s) => s.includes("IVF list imbalance"))).toBe(true);
    expect(Array.isArray(d.hotspots)).toBe(true);
    expect((d.hotspots ?? []).length).toBeGreaterThan(0);
  });
  it("stats exposes HNSW metrics and diagnose flags tombstones", () => {
    const vl = createState({
      dim: 2,
      metric: "cosine",
      strategy: "hnsw",
      hnsw: { M: 4, efConstruction: 8, efSearch: 4, seed: 1 },
    });
    // Add several points, then remove enough to push tombstone ratio > 0.3
    add(vl, 1, new Float32Array([1, 0]), null);
    add(vl, 2, new Float32Array([0.9, 0]), null);
    add(vl, 3, new Float32Array([0, 1]), null);
    add(vl, 4, new Float32Array([0, 0.9]), null);
    add(vl, 5, new Float32Array([0.7, 0.7]), null);
    add(vl, 6, new Float32Array([0.6, 0.6]), null);
    // remove 3/6 -> 0.5 tombstone ratio
    remove(vl, 4);
    remove(vl, 5);
    remove(vl, 6);
    const s = stats(vl);
    expect(s.hnsw).toBeDefined();
    const d = diagnose(vl);
    expect(d.suggestions.some((x) => x.includes("HNSW tombstone high"))).toBe(true);
  });
});
