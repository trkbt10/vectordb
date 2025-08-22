/**
 * @file Tests for connect({ wal }) returning async client with WAL attached
 */
import { connect } from "./index";
import { createMemoryFileIO } from "../storage/memory";
import { createState } from "../attr/state/create";
import { getOne } from "../attr/ops/core";
import { applyWal } from "../wal";

test("connect with wal returns async client and persists WAL", async () => {
  const mem = createMemoryFileIO();
  const storage = { index: mem, data: () => createMemoryFileIO() };
  const walIO = createMemoryFileIO();

  const client = await connect<{ tag?: string }>({
    storage,
    database: { dim: 2 },
    index: { name: "db" },
    wal: { io: walIO, name: "connect.wal" },
  });

  await client.upsert({ id: 1, vector: new Float32Array([1, 0]), meta: { tag: "a" } });
  await client.setMeta(1, { tag: "b" });
  expect((await client.get(1))?.meta).toEqual({ tag: "b" });

  // WAL should allow recovery into a fresh state
  const fresh = createState<{ tag?: string }>({ dim: 2 });
  const walBytes = await walIO.read("connect.wal");
  applyWal(fresh, walBytes);
  expect(getOne(fresh, 1)?.meta).toEqual({ tag: "b" });
});
