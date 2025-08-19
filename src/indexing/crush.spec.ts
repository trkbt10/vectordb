/**
 * @file Tests for CRUSH-like deterministic mapping
 */
import { describe, it, expect } from "bun:test";
import { crushLocate } from "./crush";
import type { CrushMap } from "./types";

describe("indexing/crush", () => {
  it("maps same id deterministically to the same pg/primary", () => {
    const crush: CrushMap = { pgs: 32, replicas: 1, targets: [{ key: "A" }, { key: "B" }, { key: "C" }] };
    const a1 = crushLocate(123, crush);
    const a2 = crushLocate(123, crush);
    expect(a1.pg).toBe(a2.pg);
    expect(a1.primaries[0]).toBe(a2.primaries[0]);
  });

  it("spreads ids across available targets roughly uniformly", () => {
    const crush: CrushMap = { pgs: 64, replicas: 1, targets: [{ key: "A" }, { key: "B" }, { key: "C" }, { key: "D" }] };
    const count: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (let id = 0; id < 1000; id++) {
      const { primaries } = crushLocate(id, crush);
      count[primaries[0]]++;
    }
    // Each target should have some assignments
    for (const k of Object.keys(count)) expect(count[k]).toBeGreaterThan(0);
  });
});
