/** @file Result-consistency: multiple clients tests */
import { connect } from "../../src/client";
import { createMemoryFileIO } from "../../src/storage/memory";

describe("result-consistency: multiple clients on shared WAL + storage", () => {
  it("a fresh client sees union of writes after quiescence via WAL replay", async () => {
    const indexIO = createMemoryFileIO();
    const dataIO = createMemoryFileIO();

    // Two clients sharing the same storage + WAL
    const makeClient = () =>
      connect<{ tag?: string }>({
        storage: { index: indexIO, data: () => dataIO },
        database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
        index: { name: "db", segmented: true },
        // Autosave disabled (no truncate); we test WAL replay behavior
        autoSave: { ops: 0, intervalMs: 0 },
      });

    const c1 = await makeClient();
    const c2 = await makeClient();

    await c1.upsert(
      { id: 1, vector: new Float32Array([1, 0, 0]), meta: { tag: "a" } },
      { id: 2, vector: new Float32Array([0, 1, 0]), meta: { tag: "b" } },
    );
    await c2.upsert(
      { id: 3, vector: new Float32Array([0, 0, 1]), meta: { tag: "c" } },
      { id: 4, vector: new Float32Array([1, 1, 0]), meta: { tag: "d" } },
    );

    // Quiescence: no more writes. A new client opens and replays the WAL.
    const reader = await makeClient();
    // Expect union of both clients' writes due to WAL replay
    expect(await reader.has(1)).toBe(true);
    expect(await reader.has(2)).toBe(true);
    expect(await reader.has(3)).toBe(true);
    expect(await reader.has(4)).toBe(true);
    // Metadata should match what writers produced
    expect((await reader.get(1))?.meta).toEqual({ tag: "a" });
    expect((await reader.get(4))?.meta).toEqual({ tag: "d" });

    // Optional: save a snapshot from the reader to persist the current state
    await reader.index.saveState(reader.state, { baseName: "db" });
    const reader2 = await makeClient();
    expect(await reader2.has(1)).toBe(true);
    expect(await reader2.has(2)).toBe(true);
    expect(await reader2.has(3)).toBe(true);
    expect(await reader2.has(4)).toBe(true);
    expect((await reader2.get(2))?.meta).toEqual({ tag: "b" });
    expect((await reader2.get(3))?.meta).toEqual({ tag: "c" });
  });
});
