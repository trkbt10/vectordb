/**
 * Consistency spec.
 *
 * Why: Ensure check/repair surfaces inconsistencies and can repair IVF lists.
 */
import { describe, it, expect } from "vitest";
import { createVectorLiteState } from "../create";
import { add } from "./core";
import { checkConsistency, repairConsistency } from "./consistency";
import { isIvfVL } from "../../util/guards";

describe("ops.consistency", () => {
  it("detects missingInIndex for IVF and can repair", () => {
    const vl = createVectorLiteState({ dim: 2, metric: "cosine", strategy: "ivf", ivf: { nlist: 4, nprobe: 2 } });
    add(vl, 1, new Float32Array([1, 0]), null);
    add(vl, 2, new Float32Array([0.9, 0]), null);
    // simulate drift
    if (isIvfVL(vl)) {
      vl.ann.idToList.clear();
      for (const lst of vl.ann.lists) lst.splice(0, lst.length);
    }
    const rep1 = checkConsistency(vl);
    expect(rep1.missingInIndex.length).toBeGreaterThan(0);
    const rep2 = repairConsistency(vl, { fixIndex: true });
    expect(rep2.missingInIndex.length).toBeGreaterThan(0);
    const rep3 = checkConsistency(vl);
    expect(rep3.missingInIndex.length).toBe(0);
  });
});
