/**
 * @file Tests for math helpers
 */
import { normalizeVectorInPlace, dotAt, l2negAt } from "./math";

describe("util/math", () => {
  it("normalizeVectorInPlace scales to unit norm and handles zeros", () => {
    const v = new Float32Array([3, 4]);
    normalizeVectorInPlace(v);
    const len = Math.hypot(v[0], v[1]);
    expect(Math.abs(len - 1)).toBeLessThan(1e-6);
    const z = new Float32Array([0, 0, 0]);
    normalizeVectorInPlace(z);
    expect(Array.from(z)).toEqual([0, 0, 0]);
  });
  it("dotAt and l2negAt compute expected scores", () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6]);
    const q = new Float32Array([1, 1, 1]);
    expect(dotAt(data, 0, q, 3)).toBe(1 + 2 + 3);
    expect(dotAt(data, 3, q, 3)).toBe(4 + 5 + 6);
    // l2 negative distance: -(sum (d - q)^2)
    const l2n = l2negAt(data, 0, new Float32Array([1, 2, 3]), 3);
    expect(l2n).toBeCloseTo(0);
  });
});
