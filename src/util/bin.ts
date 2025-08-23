/**
 * @file Binary I/O utilities for VectorDB serialization
 *
 * This module provides low-level binary reading and writing capabilities used
 * throughout VectorDB for efficient data serialization. Key features:
 *
 * - Little-endian format: Consistent byte ordering across platforms for
 *   interoperability between different architectures
 * - Streaming readers/writers: Memory-efficient processing of large vector
 *   databases without loading entire buffers into memory
 * - Type-safe primitives: Read/write methods for common data types (u32, i32, bytes)
 *   with proper TypeScript typing
 * - Zero dependencies: Pure JavaScript implementation using native ArrayBuffer
 *   and DataView APIs for maximum compatibility
 *
 * Used internally by VectorDB's persistence layer to serialize:
 * - Vector data and metadata
 * - Index structures (HNSW graphs, IVF clusters)
 * - Write-Ahead Log (WAL) entries
 * - Snapshot files
 *
 * The simple, explicit API makes the serialization format transparent and
 * debuggable, while maintaining high performance for large-scale vector operations.
 */

/** Convert ArrayBuffer to Uint8Array (no-copy when possible). */
export function toUint8(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Helper to ensure Uint8Array is compatible with BufferSource type.
 * Simply returns the input as the APIs accept TypedArrays directly.
 * The type assertion is handled at the call site.
 */
export function toBufferSource(data: Uint8Array): Uint8Array {
  return data;
}

export type BinReader = {
  readU32(): number;
  readI32(): number;
  readBytes(n: number): Uint8Array;
  offset(): number;
};

/**
 *
 */
export function createReader(buf: ArrayBufferLike): BinReader {
  const dv = new DataView(buf);
  // eslint-disable-next-line -- off is used to track the current read position
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

/**
 *
 */
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
    // eslint-disable-next-line no-restricted-syntax -- Performance: accumulating total size requires mutable counter
    let total = 0;
    for (const p of parts) {
      total += p.length;
    }

    const out = new Uint8Array(total);
    // eslint-disable-next-line no-restricted-syntax -- Performance: tracking offset position requires mutable variable
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  return { pushU32, pushI32, pushBytes, concat };
}
