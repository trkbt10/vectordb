/**
 * @file Tests for top-k helpers
 */
import { pushTopK, pushSortedDesc } from "./topk";

describe("util/topk", () => {
  it("pushTopK maintains top-k in descending order", () => {
    const out: { id: number; s: number }[] = [];
    const get = (x: { s: number }) => x.s;
    for (const s of [0.1, 0.9, 0.3, 0.7, 0.5]) {
      pushTopK(out, { id: Math.random(), s }, 3, get);
    }
    expect(out).toHaveLength(3);
    expect(out[0]!.s >= out[1]!.s && out[1]!.s >= out[2]!.s).toBe(true);
    // pushing small score should not change
    pushTopK(out, { id: 99, s: -1 }, 3, get);
    expect(out.find((x) => x.id === 99)).toBeUndefined();
  });
  it("pushSortedDesc inserts and enforces limit", () => {
    const arr: { s: number }[] = [];
    for (const s of [0.2, 0.8, 0.5, 0.9]) {
      pushSortedDesc(arr, { s }, 3);
    }
    expect(arr.map((x) => x.s)).toEqual([0.9, 0.8, 0.5]);
  });
});
