/** Core ops smoke test (module-local) */

/**
 * @file Unit tests for core attribute operations
 */
import { createState } from "../state/create";
import { add, size, search } from "./core";

describe("ops.core", () => {
  it("add/size/search work", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(vl, 1, new Float32Array([1, 0]), null);
    expect(size(vl)).toBe(1);
    const hits = search(vl, new Float32Array([1, 0]), { k: 1 });
    expect(hits[0]?.id).toBe(1);
  });
});
