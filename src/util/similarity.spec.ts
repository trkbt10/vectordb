/**
 * @file Tests for similarity scoring function registry
 */
import { getScoreAtFn } from "./similarity";

describe("util/similarity", () => {
  it("returns correct function per metric", () => {
    const data = new Float32Array([1, 0, 0, 0, 1, 0]);
    const q = new Float32Array([1, 0, 0]);
    const cos = getScoreAtFn("cosine");
    const dot = getScoreAtFn("dot");
    const l2 = getScoreAtFn("l2");
    expect(cos(data, 0, q, 3)).toBeCloseTo(1);
    expect(dot(data, 3, q, 3)).toBeCloseTo(0);
    expect(l2(data, 0, q, 3)).toBeCloseTo(0);
  });
  it("throws on unsupported metric", () => {
    const bad = getScoreAtFn as unknown as (m: string) => unknown;
    expect(() => bad("manhattan")).toThrow(/Unsupported metric/);
  });
});
