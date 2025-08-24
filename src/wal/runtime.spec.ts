/**
 * @file WAL runtime tests (append/replay/truncate with FileIO)
 */
import { createWalRuntime, encodeWal, decodeWal } from "./index";
import { createMemoryFileIO } from "../storage/memory";
import { createState } from "../attr/state/create";
import { getOne } from "../attr/ops/core";

describe("wal/runtime", () => {
  it("append writes encoded records to IO", async () => {
    const io = createMemoryFileIO();
    const rt = createWalRuntime(io, "log.wal");
    const records = [{ type: "remove", id: 1 } as const];
    await rt.append(records);
    const bytes = await io.read("log.wal");
    const decoded = decodeWal(bytes);
    expect(decoded.length).toBe(1);
    expect(decoded[0]).toEqual({ type: "remove", id: 1 });
  });

  it("replayInto returns {applied:0} when file missing or invalid, then applies after append", async () => {
    const io = createMemoryFileIO();
    const rt = createWalRuntime(io, "events.wal");
    const s = createState<{ t?: string }>({ dim: 2 });
    const r0 = await rt.replayInto(s);
    expect(r0).toEqual({ applied: 0 });

    const recs = [{ type: "upsert", id: 7, vector: new Float32Array([1, 0]), meta: { t: "x" } }] as const;
    await rt.append(recs as unknown as Parameters<typeof encodeWal>[0]);
    const r1 = await rt.replayInto(s);
    expect(r1).toEqual({ applied: 1 });
    expect(getOne(s, 7)?.meta).toEqual({ t: "x" });
  });

  it("truncate clears log to zero length and replayInto becomes no-op", async () => {
    const io = createMemoryFileIO();
    const rt = createWalRuntime(io, "t.wal");
    await rt.append([{ type: "remove", id: 2 }]);
    const before = await io.read("t.wal");
    expect(before.length).toBeGreaterThan(0);
    await rt.truncate();
    const after = await io.read("t.wal");
    expect(after.length).toBe(0);
    const s = createState<{ n?: number }>({ dim: 2 });
    const res = await rt.replayInto(s);
    expect(res).toEqual({ applied: 0 });
  });
});
