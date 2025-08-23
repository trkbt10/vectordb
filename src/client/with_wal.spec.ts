/**
 * @file Tests for withWal wrapper returning async client operations
 */
import { createState } from "../attr/state/create";
import { connect } from "./index";
import { getOne } from "../attr/ops/core";
import { applyWal } from "../wal";
import { createMemoryFileIO } from "../storage/memory";

test("connect returns async client with WAL and methods work", async () => {
  type Meta = { tag?: string };
  const mem = createMemoryFileIO();
  const client = await connect<Meta>({
    storage: { index: mem, data: () => mem },
    database: { dim: 2 },
    index: { name: "wal.spec" },
  });

  await client.upsert({ id: 1, vector: new Float32Array([1, 0]), meta: { tag: "a" } });
  await client.setMeta(1, { tag: "b" });
  expect(getOne(client.state, 1)?.meta).toEqual({ tag: "b" });

  // Replay into a fresh state to verify WAL content
  // WAL should allow recovery into a fresh state
  const state2 = createState<Meta>({ dim: 2 });
  const u8 = await mem.read("wal.spec.wal");
  applyWal(state2, u8);
  expect(getOne(state2, 1)?.meta).toEqual({ tag: "b" });
});
