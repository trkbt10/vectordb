/**
 * @file Write-Ahead Log (WAL) implementation for crash recovery
 * Provides WAL binary format helpers and application routines.
 */
import { add, remove, setMeta } from "../attr/ops/core";
import {
  WalTooShortError,
  WalHeaderTruncatedError,
  WalBadMagicError,
  WalUnsupportedVersionError,
  WalTruncatedRecordError,
  WalDecodeError,
} from "./errors";
import { crc32, readWalChecksum } from "./checksum";
import type { AttrIndex, Attrs } from "../attr/index";
import type { VectorStoreState } from "../types";

const MAGIC = 0x564c5741; // 'VLWA'
const VERSION = 1;

/** WAL record union used by encoder/decoder. */
export type WalRecord =
  | { type: "upsert"; id: number; vector: Float32Array; meta: unknown | null }
  | { type: "remove"; id: number }
  | { type: "setMeta"; id: number; meta: unknown | null };

/** Encode WAL records into a binary segment (with header). */
export function encodeWal(records: WalRecord[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const header = new Uint8Array(8);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, VERSION, true);
  parts.push(header);
  for (const r of records) {
    if (r.type === "remove") {
      const rec = new Uint8Array(1 + 1 + 4 + 4 + 4);
      const dv2 = new DataView(rec.buffer);
      dv2.setUint8(0, 2);
      dv2.setUint8(1, 0);
      dv2.setUint32(2, r.id >>> 0, true);
      dv2.setUint32(6, 0, true);
      dv2.setUint32(10, 0, true);
      parts.push(rec);
      continue;
    }
    if (r.type === "setMeta") {
      const metaBytes = new TextEncoder().encode(JSON.stringify(r.meta ?? null));
      const rec = new Uint8Array(1 + 1 + 4 + 4 + 4 + metaBytes.length);
      const dv2 = new DataView(rec.buffer);
      dv2.setUint8(0, 3);
      dv2.setUint8(1, 0);
      dv2.setUint32(2, r.id >>> 0, true);
      dv2.setUint32(6, metaBytes.length >>> 0, true);
      dv2.setUint32(10, 0, true);
      rec.set(metaBytes, 14);
      parts.push(rec);
      continue;
    }
    const metaBytes = new TextEncoder().encode(JSON.stringify(r.meta ?? null));
    const vecBytes = new Uint8Array(
      r.vector.buffer.slice(r.vector.byteOffset, r.vector.byteOffset + r.vector.byteLength),
    );
    const rec = new Uint8Array(1 + 1 + 4 + 4 + 4 + metaBytes.length + vecBytes.length);
    const dv2 = new DataView(rec.buffer);
    dv2.setUint8(0, 1);
    dv2.setUint8(1, 0);
    dv2.setUint32(2, r.id >>> 0, true);
    dv2.setUint32(6, metaBytes.length >>> 0, true);
    dv2.setUint32(10, vecBytes.length >>> 0, true);
    rec.set(metaBytes, 14);
    rec.set(vecBytes, 14 + metaBytes.length);
    parts.push(rec);
  }
  // eslint-disable-next-line no-restricted-syntax -- accumulating output size
  let total = 0;
  for (const p of parts) {
    total += p.length;
  }
  const out = new Uint8Array(total);
  // eslint-disable-next-line no-restricted-syntax -- tracking offset during concat
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Decode a WAL buffer into records. Supports concatenated segments. */
export function decodeWal(u8: Uint8Array): WalRecord[] {
  if (u8.length < 8) {
    throw new WalTooShortError();
  }
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // eslint-disable-next-line no-restricted-syntax -- parser offset state
  let off = 0;
  function readHeader(at: number): number {
    if (at + 8 > u8.length) {
      throw new WalHeaderTruncatedError();
    }
    const mg = dv.getUint32(at, true);
    if (mg !== MAGIC) {
      throw new WalBadMagicError();
    }
    const ver = dv.getUint32(at + 4, true);
    if (ver !== VERSION) {
      throw new WalUnsupportedVersionError();
    }
    return at + 8;
  }
  off = readHeader(0);
  const out: WalRecord[] = [];
  while (off < u8.length) {
    if (off + 8 <= u8.length && dv.getUint32(off, true) === MAGIC && dv.getUint32(off + 4, true) === VERSION) {
      off = readHeader(off);
      if (off >= u8.length) {
        break;
      }
    }
    const type = dv.getUint8(off);
    off += 1;
    off += 1; // reserved
    const id = dv.getUint32(off, true);
    off += 4;
    const metaLen = dv.getUint32(off, true);
    off += 4;
    const vecLen = dv.getUint32(off, true);
    off += 4;
    // bounds check for meta block
    if (metaLen >>> 0 !== metaLen || off + metaLen > u8.length) {
      throw new WalTruncatedRecordError("meta");
    }
    const meta: unknown | null = (() => {
      if (metaLen > 0) {
        const mb = u8.subarray(off, off + metaLen);
        off += metaLen;
        return JSON.parse(new TextDecoder().decode(mb));
      }
      return null;
    })();
    if (type === 2) {
      out.push({ type: "remove", id });
      continue;
    }
    if (type === 3) {
      out.push({ type: "setMeta", id, meta });
      continue;
    }
    if (type === 1 && vecLen > 0) {
      if (vecLen >>> 0 !== vecLen || off + vecLen > u8.length) {
        throw new WalTruncatedRecordError("vector");
      }
      const vb = u8.subarray(off, off + vecLen);
      off += vecLen;
      const vector = new Float32Array(vb.buffer.slice(vb.byteOffset, vb.byteOffset + vb.byteLength));
      out.push({ type: "upsert", id, vector, meta });
      continue;
    }
    throw new WalDecodeError();
  }
  return out;
}

/** Apply WAL to a VectorStoreState (idempotent upserts). */
export function applyWal<TMeta>(vl: VectorStoreState<TMeta>, walBytes: Uint8Array): void {
  const records = decodeWal(walBytes);
  for (const r of records) {
    if (r.type === "remove") {
      remove(vl, r.id);
      continue;
    }
    if (r.type === "setMeta") {
      setMeta(vl, r.id, r.meta as TMeta | null);
      continue;
    }
    add(vl, r.id, r.vector, r.meta as TMeta | null, { upsert: true });
  }
}

export type MetaToAttrs<TMeta> = (meta: TMeta | null) => Attrs | null;

/** Apply WAL and keep attribute index in sync via projector. */
export function applyWalWithIndex<TMeta>(
  vl: VectorStoreState<TMeta>,
  walBytes: Uint8Array,
  index: AttrIndex,
  projector: MetaToAttrs<TMeta>,
): void {
  const records = decodeWal(walBytes);
  for (const r of records) {
    if (r.type === "remove") {
      remove(vl, r.id);
      index.removeId(r.id);
      continue;
    }
    if (r.type === "setMeta") {
      const meta = r.meta as TMeta | null;
      setMeta(vl, r.id, meta);
      index.setAttrs(r.id, projector(meta));
      continue;
    }
    const meta = r.meta as TMeta | null;
    add(vl, r.id, r.vector, meta, { upsert: true });
    index.setAttrs(r.id, projector(meta));
  }
}

/**
 * Verify WAL structure and optional footer checksum.
 */
export function verifyWal(u8: Uint8Array): {
  ok: boolean;
  error?: Error;
  checksum?: { present: boolean; ok?: boolean; value?: number; computed?: number };
} {
  const res: {
    ok: boolean;
    error?: Error;
    checksum?: { present: boolean; ok?: boolean; value?: number; computed?: number };
  } = {
    ok: true,
  };
  try {
    const ck = readWalChecksum(u8);
    const body = ck.has ? u8.subarray(0, u8.length - 8) : u8;
    // Decode to ensure structural correctness
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- decode for side-effects (verification)
    const _ = decodeWal(body);
    if (!ck.has) {
      res.checksum = { present: false };
      return res;
    }
    const computed = crc32(body);
    res.checksum = { present: true, ok: computed === ck.value, value: ck.value, computed };
    if (computed !== ck.value) {
      res.ok = false;
    }
  } catch (e) {
    res.ok = false;
    res.error = e as Error;
  }
  return res;
}
