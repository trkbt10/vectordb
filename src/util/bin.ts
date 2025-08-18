/** Utilities for simple binary IO (little-endian) */

export type BinReader = {
  readU32(): number;
  readI32(): number;
  readBytes(n: number): Uint8Array;
  offset(): number;
};

export function createReader(buf: ArrayBufferLike): BinReader {
  const dv = new DataView(buf);
  let off = 0;
  function readU32(): number {
    const v = dv.getUint32(off, true);
    off += 4;
    return v;
  }
  function readI32(): number {
    const v = dv.getInt32(off, true);
    off += 4;
    return v;
  }
  function readBytes(n: number): Uint8Array {
    const u8 = new Uint8Array(buf.slice(off, off + n));
    off += n;
    return u8;
  }
  function offset(): number {
    return off;
  }
  return { readU32, readI32, readBytes, offset };
}

export type BinWriter = {
  pushU32(v: number): void;
  pushI32(v: number): void;
  pushBytes(u8: Uint8Array): void;
  concat(): Uint8Array;
};

export function createWriter(): BinWriter {
  const parts: Uint8Array[] = [];
  function pushU32(v: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v >>> 0, true);
    parts.push(b);
  }
  function pushI32(v: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, v | 0, true);
    parts.push(b);
  }
  function pushBytes(u8: Uint8Array): void {
    parts.push(u8);
  }
  function concat(): Uint8Array {
    let total = 0;
    for (const p of parts) {
      total += p.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  return { pushU32, pushI32, pushBytes, concat };
}
/**
 * Binary reader/writer utilities over Uint8Array buffers.
 *
 * Why: Keep serialization code small and explicit, with no external deps,
 * while supporting cross-environment ArrayBuffer handling.
 */
