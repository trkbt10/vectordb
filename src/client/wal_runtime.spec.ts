/**
 * @file Tests for client-side WAL runtime with FileIO
 */
import { createState } from "../attr/state/create";
import { getOne } from "../attr/ops/core";
import { createMemoryFileIO } from "../storage/memory";
import { createWalRuntime } from "../wal/index";

test("WalRuntime append/replay/truncate with memory FileIO", async () => {
  const io = createMemoryFileIO();
  const wal = createWalRuntime(io, "test.wal");
  const state = createState<{ tag?: string }>({ dim: 2 });

  // no file yet -> best-effort replay returns { applied: 0 }
  const r0 = await wal.replayInto(state);
  expect(r0).toEqual({ applied: 0 });

  // append a couple of operations
  await wal.append([
    { type: "upsert", id: 1, vector: new Float32Array([1, 0]), meta: { tag: "a" } },
    { type: "setMeta", id: 1, meta: { tag: "b" } },
  ]);

  // re-create state and replay into it
  const state2 = createState<{ tag?: string }>({ dim: 2 });
  const r1 = await wal.replayInto(state2);
  expect(r1).toEqual({ applied: 1 });
  expect(getOne(state2, 1)?.meta).toEqual({ tag: "b" });

  // truncate and verify replay becomes no-op
  await wal.truncate();
  const state3 = createState<{ tag?: string }>({ dim: 2 });
  const r2 = await wal.replayInto(state3);
  expect(r2).toEqual({ applied: 0 });
});
