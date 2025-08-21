/**
 * @file Tests for bruteforce ANN strategy
 */
import { createState } from "../attr/state/create";
import { add, search } from "../attr/ops/core";
import { bf_search, createBruteforceState, bf_add, bf_remove, bf_serialize, bf_deserialize } from "./bruteforce";

describe("ann/bruteforce", () => {
  it("filters results and returns top-k", () => {
    const db = createState<{ g?: string }>({ dim: 2, metric: "cosine", strategy: "bruteforce" });
    add(db, 1, new Float32Array([1, 0]), { g: "a" });
    add(db, 2, new Float32Array([0.9, 0]), { g: "b" });
    // filter out id=2
    const hits = search(db, new Float32Array([1, 0]), { k: 2, filter: (id) => id !== 2 });
    expect(hits.map((h) => h.id)).toEqual([1]);
  });

  it("throws on dim mismatch in bf_search", () => {
    const db = createState({ dim: 3, metric: "cosine", strategy: "bruteforce" });
    add(db, 1, new Float32Array([1, 0, 0]), null);
    const bf = createBruteforceState("cosine");
    expect(() => bf_search(bf, db.store, new Float32Array([1, 0]), 1)).toThrow(/dim mismatch/);
  });

  it("covers no-op add/remove and (de)serialize", () => {
    const bf = createBruteforceState("cosine");
    expect(typeof bf).toBe("object");
    // call no-ops to mark coverage
    bf_add();
    bf_remove();
    const buf = bf_serialize();
    expect(buf).toBeInstanceOf(ArrayBuffer);
    bf_deserialize();
  });
});
