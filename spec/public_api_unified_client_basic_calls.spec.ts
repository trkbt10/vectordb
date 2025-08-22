/**
 * @file public api unified client basic calls spec
 * Purpose: Ensure the public VectorDB client exposes the unified find/findMany API
 * and that basic CRUD + query entrypoints are callable without errors.
 * The correctness of search behavior is covered by unit tests elsewhere.
 */
import { connect } from "../src/client/index";
import type { FilterExpr } from "../src/index";

describe("public api unified client basic calls", () => {
  it("constructs a client and performs basic CRUD", async () => {
    const client = await connect<{ tag?: string; v?: number }>({
      storage: {
        index: {
          async read() {
            throw new Error("no");
          },
          async write() {},
          async append() {},
          async atomicWrite() {},
        },
        data: {
          async read() {
            throw new Error("no");
          },
          async write() {},
          async append() {},
          async atomicWrite() {},
        },
      },
      database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
    });
    const db = client;
    // size empty
    expect(db.size).toBe(0);

    // set single
    await db.set(1, { vector: new Float32Array([1, 0, 0]), meta: { tag: "a" } });
    expect(await db.has(1)).toBe(true);
    expect((await db.get(1))?.meta).toEqual({ tag: "a" });

    // upsert with object form
    await db.set(1, { vector: new Float32Array([1, 0, 0]), meta: { tag: "aa" } }, { upsert: true });
    expect((await db.get(1))?.meta).toEqual({ tag: "aa" });

    // push multiple
    const added = await db.push(
      { id: 2, vector: new Float32Array([0, 1, 0]), meta: { tag: "b", v: 10 } },
      { id: 3, vector: new Float32Array([0, 0, 1]), meta: null },
    );
    expect(added).toBe(2);
    expect(db.size).toBe(3);

    // delete
    expect(await db.delete(3)).toBe(true);
    expect(await db.has(3)).toBe(false);
  });

  it("calls unified find/findMany including expr + filter forms", async () => {
    const client2 = await connect<{ tag?: string; v?: number }>({
      storage: {
        index: {
          async read() {
            throw new Error("no");
          },
          async write() {},
          async append() {},
          async atomicWrite() {},
        },
        data: {
          async read() {
            throw new Error("no");
          },
          async write() {},
          async append() {},
          async atomicWrite() {},
        },
      },
      database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
    });
    const db = client2;
    await db.upsert(
      { id: 1, vector: new Float32Array([1, 0, 0]), meta: { tag: "a", v: 1 } },
      { id: 2, vector: new Float32Array([0, 1, 0]), meta: { tag: "b", v: 2 } },
      { id: 3, vector: new Float32Array([0, 0, 1]), meta: { tag: "c", v: 3 } },
    );
    // update vector/meta separately
    await db.setVector(2, new Float32Array([0.1, 0.9, 0]), { upsert: true });
    await db.setMeta(3, { tag: "cc", v: 30 });

    // findMany basic
    const many = await db.findMany(new Float32Array([1, 0, 0]), { k: 2 });
    expect(Array.isArray(many)).toBe(true);

    // find basic
    const one = await db.find(new Float32Array([1, 0, 0]));
    expect(one === null || typeof one.id === "number").toBe(true);

    // findMany with filter callback
    const filtered = await db.findMany(new Float32Array([0, 1, 0]), {
      k: 3,
      filter: (_id: number, meta: { tag?: string } | null) => (meta?.tag ?? "") !== "b",
    });
    expect(Array.isArray(filtered)).toBe(true);

    // findMany with filter expression (meta scope)
    const expr: FilterExpr = { key: "tag", scope: "meta", match: "a" };
    const exprHits = await db.findMany(new Float32Array([1, 0, 0]), { expr, k: 1 });
    expect(Array.isArray(exprHits)).toBe(true);

    // find with expr + exprOpts (no index supplied; options are still accepted)
    const e2: FilterExpr = { key: "v", scope: "meta", range: { gte: 1 } };
    const best = await db.find(new Float32Array([1, 0, 0]), { expr: e2, exprOpts: { hnsw: { mode: "soft" } } });
    expect(best === null || typeof best.id === "number").toBe(true);
  });
});
