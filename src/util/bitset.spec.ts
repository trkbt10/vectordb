/**
 * @file Tests for bitset helpers
 */
import { createBitMask, maskSet, maskHas } from "./bitset";

describe("util/bitset", () => {
  it("create/maskSet/maskHas behave within bounds and ignore out-of-range", () => {
    const m = createBitMask(4);
    expect(Array.from(m)).toEqual([0, 0, 0, 0]);
    maskSet(m, 2);
    expect(maskHas(m, 2)).toBe(true);
    expect(maskHas(m, 3)).toBe(false);
    // out of bounds should not throw or set
    maskSet(m, 10);
    expect(Array.from(m)).toEqual([0, 0, 1, 0]);
  });
});
