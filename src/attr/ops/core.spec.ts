/** Core ops smoke test (module-local) */

/**
 * @file Unit tests for core attribute operations
 */
import { createState } from "../state/create";
import { add, size, search, addMany, remove } from "./core";

describe("ops.core", () => {
  it("add/size/search work", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(vl, 1, new Float32Array([1, 0]), null);
    expect(size(vl)).toBe(1);
    const hits = search(vl, new Float32Array([1, 0]), { k: 1 });
    expect(hits[0]?.id).toBe(1);
  });
  it("addMany triggers ensure+capacity path and remove returns booleans", () => {
    const h = createState({ dim: 2, metric: "cosine", strategy: "hnsw", hnsw: { M: 4, efConstruction: 16 } });
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, vector: new Float32Array([1, 0]), meta: null }));
    addMany(h, rows);
    expect(search(h, new Float32Array([1, 0]), { k: 1 }).length).toBe(1);
    // remove existing/missing
    expect(remove(h, 1)).toBe(true);
    expect(remove(h, 99999)).toBe(false);
  });
});
