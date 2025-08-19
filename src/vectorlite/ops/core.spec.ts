/** Core ops smoke test (module-local) */
import { describe, it, expect } from "vitest";
import { createVectorLiteState } from "../create";
import { add, size, search } from "./core";

describe("ops.core", () => {
  it("add/size/search work", () => {
    const vl = createVectorLiteState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(vl, 1, new Float32Array([1, 0]), null);
    expect(size(vl)).toBe(1);
    const hits = search(vl, new Float32Array([1, 0]), { k: 1 });
    expect(hits[0]?.id).toBe(1);
  });
});
