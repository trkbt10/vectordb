/**
 * Bulk ops spec.
 *
 * Why: Ensure upsertMany/removeMany aggregate results and mutate state correctly.
 */

/**
 * @file Unit tests for bulk operations
 */
import { createState } from "../state/create";
import { upsertMany, removeMany } from "./bulk";

describe("ops.bulk", () => {
  it("upsertMany/removeMany work with counts", () => {
    const vl = createState({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    const res = upsertMany(vl, [
      { id: 1, vector: new Float32Array([1, 0]), meta: null },
      { id: 2, vector: new Float32Array([0.9, 0]), meta: null },
    ]);
    expect(res.ok).toBe(2);
    const rm = removeMany(vl, [1, 3], { ignoreMissing: false });
    expect(rm.ok).toBe(1);
    expect(rm.missing).toContain(3);
  });
});
