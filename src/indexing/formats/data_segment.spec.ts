/**
 * @file Tests for data segment format (encode/decode, read/write)
 */

import { DataSegmentWriter, DataSegmentReader, encodeRow, decodeRow } from "./data_segment";
import { createMemoryFileIO } from "../../storage/memory";

describe("indexing/formats/data_segment", () => {
  it("encodes and decodes a row", () => {
    const row = { id: 42, meta: { a: 1 }, vector: new Float32Array([1, 2, 3]) };
    const u8 = encodeRow(row);
    const r2 = decodeRow(u8);
    expect(r2.id).toBe(42);
    expect(r2.meta).toEqual({ a: 1 });
    expect(Array.from(r2.vector)).toEqual([1, 2, 3]);
  });

  it("writes and reads a segment file", async () => {
    const w = new DataSegmentWriter("seg.test");
    w.append({ id: 1, meta: null, vector: new Float32Array([0, 1]) });
    w.append({ id: 2, meta: { t: "x" }, vector: new Float32Array([2, 3]) });
    const io = createMemoryFileIO();
    await w.writeAtomic(io, "seg.test.data");
    const reader = await DataSegmentReader.fromFile(io, "seg.test.data", "seg.test");
    const rows = Array.from(reader.rows()).map((x) => x.row);
    expect(rows.length).toBe(2);
    expect(rows[0].id).toBe(1);
    expect(rows[1].id).toBe(2);
    expect(rows[1].meta).toEqual({ t: "x" });
    expect(Array.from(rows[1].vector)).toEqual([2, 3]);
  });
});
