/**
 * @file Data segment binary format (vectors + metadata)
 */
import type { FileIO } from "../../storage/types";
import { toUint8 } from "../../storage/types";

// Simple segmented data file format for vector rows
// Header: MAGIC u32 ('VLDT'), VERSION u32 (1)
// Record: id u32, metaLen u32, vecLen u32, meta JSON bytes, vec bytes
const D_MAGIC = 0x564c4454; // 'VLDT'
const D_VERSION = 1;

export type EncodedRow = { id: number; meta: unknown | null; vector: Float32Array };

/** Encode a single row (id, meta, vector) into binary. */
export function encodeRow(r: EncodedRow): Uint8Array {
  const metaBytes = new TextEncoder().encode(JSON.stringify(r.meta));
  const vecBytes = new Uint8Array(
    r.vector.buffer.slice(r.vector.byteOffset, r.vector.byteOffset + r.vector.byteLength),
  );
  const out = new Uint8Array(4 + 4 + 4 + metaBytes.length + vecBytes.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, r.id >>> 0, true);
  dv.setUint32(4, metaBytes.length >>> 0, true);
  dv.setUint32(8, vecBytes.length >>> 0, true);
  out.set(metaBytes, 12);
  out.set(vecBytes, 12 + metaBytes.length);
  return out;
}

/** Decode a single row from binary slice. */
export function decodeRow(u8: Uint8Array): EncodedRow {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const id = dv.getUint32(0, true);
  const metaLen = dv.getUint32(4, true);
  const vecLen = dv.getUint32(8, true);
  const metaStart = 12;
  const vecStart = metaStart + metaLen;
  const metaBytes = u8.subarray(metaStart, metaStart + metaLen);
  const vecBytes = u8.subarray(vecStart, vecStart + vecLen);
  const meta = JSON.parse(new TextDecoder().decode(metaBytes));
  const vector = new Float32Array(
    vecBytes.buffer.slice(vecBytes.byteOffset, vecBytes.byteOffset + vecBytes.byteLength),
  );
  return { id, meta, vector };
}

/* eslint-disable no-restricted-syntax -- Using class syntax for stateful binary IO is pragmatic here. */
/** DataSegmentWriter: buffered writer assembling a segment in memory. */
export class DataSegmentWriter {
  readonly name: string;
  private parts: Uint8Array[] = [];
  private size = 0;
  constructor(name: string) {
    this.name = name;
    const header = new Uint8Array(8);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, D_MAGIC, true);
    dv.setUint32(4, D_VERSION, true);
    this.parts.push(header);
    this.size += header.length;
  }
  /** Append a row and return its pointer within this segment. */
  append(row: EncodedRow): { offset: number; length: number } {
    const rec = encodeRow(row);
    const ptr = { offset: this.size, length: rec.length };
    this.parts.push(rec);
    this.size += rec.length;
    return ptr;
  }
  /** Concatenate buffered parts into a single Uint8Array. */
  concat(): Uint8Array {
    let total = 0;
    for (const p of this.parts) total += p.length;
    const out = new Uint8Array(total);

    let off = 0;
    for (const p of this.parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  /** Atomically write the segment to storage. */
  async writeAtomic(io: FileIO, path: string): Promise<void> {
    const buf = this.concat();
    await io.atomicWrite(path, buf);
  }
}

/** DataSegmentReader: random-access and iteration over a segment. */

/** DataSegmentReader: random-access and iteration over a segment. */
export class DataSegmentReader {
  readonly name: string;
  private buf: Uint8Array;
  constructor(name: string, buf: Uint8Array) {
    this.name = name;
    this.buf = buf;
    if (buf.length < 8) throw new Error("data segment too short");
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const mg = dv.getUint32(0, true);
    const ver = dv.getUint32(4, true);
    if (mg !== D_MAGIC) throw new Error("bad data segment magic");
    if (ver !== D_VERSION) throw new Error("unsupported data segment version");
  }
  // Iterate rows with their offsets
  /** Iterate rows in this segment with their offsets and lengths. */
  *rows(): Generator<{ off: number; len: number; row: EncodedRow }> {
    let off = 8;
    const u8 = this.buf;
    while (off < u8.length) {
      const dv = new DataView(u8.buffer, u8.byteOffset + off, u8.byteLength - off);
      if (off + 12 > u8.length) break;
      const metaLen = dv.getUint32(4, true);
      const vecLen = dv.getUint32(8, true);
      const total = 12 + metaLen + vecLen;
      if (off + total > u8.length) break;
      const slice = u8.subarray(off, off + total);
      const row = decodeRow(slice);
      yield { off, len: total, row };
      off += total;
    }
  }
  /** Read a row at a given pointer. */
  readAt(offset: number, length: number): EncodedRow {
    const u8 = this.buf.subarray(offset, offset + length);
    return decodeRow(u8);
  }
  /** Load a segment from storage by path. */
  static async fromFile(io: FileIO, path: string, name: string): Promise<DataSegmentReader> {
    const buf = await io.read(path);
    return new DataSegmentReader(name, toUint8(buf));
  }
}
