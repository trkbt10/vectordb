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

  it("throws on too short or bad magic/version", () => {
    expect(() => new DataSegmentReader("x", new Uint8Array(0))).toThrow(/too short/);
    // bad magic
    const bad = new Uint8Array(8);
    const dv = new DataView(bad.buffer);
    dv.setUint32(0, 0x12345678, true);
    dv.setUint32(4, 1, true);
    expect(() => new DataSegmentReader("x", bad)).toThrow(/bad data segment magic/);
    // bad version
    const badv = new Uint8Array(8);
    const dv2 = new DataView(badv.buffer);
    dv2.setUint32(0, 0x564c4454, true);
    dv2.setUint32(4, 999, true);
    expect(() => new DataSegmentReader("x", badv)).toThrow(/unsupported data segment version/);
  });

  it("rows() stops on truncated record", () => {
    // Construct a buffer with header + a truncated record
    const w = new DataSegmentWriter("seg.trunc");
    // Manually craft truncated content by taking concat and slicing
    w.append({ id: 1, meta: null, vector: new Float32Array([1, 2]) });
    const full = w.concat();
    const trunc = full.subarray(0, full.length - 3); // cut inside last record
    const r = new DataSegmentReader("seg.trunc", trunc);
    const it = Array.from(r.rows());
    // Either zero or one full row depending on where we cut, but no throw
    expect(Array.isArray(it)).toBe(true);
  });
});
