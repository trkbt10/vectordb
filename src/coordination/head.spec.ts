/** @file Coordination: head CAS and read staleness specs */
import { tryUpdateHead, isReadableAt } from "./head";

describe("coordination/head", () => {
  it("CAS requires non-decreasing epoch and increasing commitTs", () => {
    const a = { manifest: "m1", epoch: 1, commitTs: 100 };
    const b = { manifest: "m2", epoch: 1, commitTs: 101 };
    const c = { manifest: "m3", epoch: 0, commitTs: 200 };
    const d = { manifest: "m4", epoch: 2, commitTs: 150 };
    expect(tryUpdateHead(null, a).ok).toBe(true);
    expect(tryUpdateHead(a, b).ok).toBe(true);
    expect(tryUpdateHead(b, c).ok).toBe(false);
    expect(tryUpdateHead(b, d).ok).toBe(true);
  });

  it("readable iff commitTs <= readTs", () => {
    const h = { manifest: "m", epoch: 1, commitTs: 200 };
    expect(isReadableAt(h, 199)).toBe(false);
    expect(isReadableAt(h, 200)).toBe(true);
    expect(isReadableAt(h, 250)).toBe(true);
  });
});
