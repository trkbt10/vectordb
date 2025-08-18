import { add, remove, setMeta } from './vectorlite/ops/core'
import type { AttrIndex, Attrs } from './attr/index'
import type { VectorLiteState } from './types'

// Simple WAL format (little-endian)
// Header: 'VLWA' (4 bytes), version u32 (1)
// Records: type u8, reserved u8, id u32, metaLen u32, vecLen u32, meta JSON bytes, vec bytes (Float32Array)
// Types: 1=upsert(add/update vector+meta), 2=remove, 3=setMeta(meta only)

const MAGIC = 0x564c5741 // 'VLWA'
const VERSION = 1

export type WalRecord =
  | { type: 'upsert'; id: number; vector: Float32Array; meta: unknown | null }
  | { type: 'remove'; id: number }
  | { type: 'setMeta'; id: number; meta: unknown | null }

/**
 *
 */
export function encodeWal(records: WalRecord[]): Uint8Array {
  const parts: Uint8Array[] = []
  const header = new Uint8Array(8)
  const dv = new DataView(header.buffer)
  dv.setUint32(0, MAGIC, true)
  dv.setUint32(4, VERSION, true)
  parts.push(header)
  for (const r of records) {
    if (r.type === 'remove') {
      const rec = new Uint8Array(1 + 1 + 4 + 4 + 4)
      const dv2 = new DataView(rec.buffer)
      dv2.setUint8(0, 2)
      dv2.setUint8(1, 0)
      dv2.setUint32(2, r.id >>> 0, true)
      dv2.setUint32(6, 0, true) // metaLen=0
      dv2.setUint32(10, 0, true) // vecLen=0
      parts.push(rec)
      continue
    }
    if (r.type === 'setMeta') {
      const metaBytes = new TextEncoder().encode(JSON.stringify(r.meta))
      const rec = new Uint8Array(1 + 1 + 4 + 4 + 4 + metaBytes.length)
      const dv2 = new DataView(rec.buffer)
      dv2.setUint8(0, 3)
      dv2.setUint8(1, 0)
      dv2.setUint32(2, r.id >>> 0, true)
      dv2.setUint32(6, metaBytes.length >>> 0, true)
      dv2.setUint32(10, 0, true) // vecLen=0
      rec.set(metaBytes, 14)
      parts.push(rec)
      continue
    }
    // upsert
    const metaBytes = new TextEncoder().encode(JSON.stringify(r.meta))
    const vecBytes = new Uint8Array(r.vector.buffer.slice(r.vector.byteOffset, r.vector.byteOffset + r.vector.byteLength))
    const rec = new Uint8Array(1 + 1 + 4 + 4 + 4 + metaBytes.length + vecBytes.length)
    const dv2 = new DataView(rec.buffer)
    dv2.setUint8(0, 1)
    dv2.setUint8(1, 0)
    dv2.setUint32(2, r.id >>> 0, true)
    dv2.setUint32(6, metaBytes.length >>> 0, true)
    dv2.setUint32(10, vecBytes.length >>> 0, true)
    rec.set(metaBytes, 14)
    rec.set(vecBytes, 14 + metaBytes.length)
    parts.push(rec)
  }
  // concat
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

/**
 *
 */
export function decodeWal(u8: Uint8Array): WalRecord[] {
  if (u8.length < 8) throw new Error('wal too short')
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let off = 0
  // allow multiple concatenated WAL segments (each starts with header)
  function readHeader(at: number): number {
    if (at + 8 > u8.length) throw new Error('truncated wal header')
    const mg = dv.getUint32(at, true)
    if (mg !== MAGIC) throw new Error('bad wal magic')
    const ver = dv.getUint32(at + 4, true)
    if (ver !== VERSION) throw new Error('unsupported wal version')
    return at + 8
  }
  // initial header
  off = readHeader(0)
  const out: WalRecord[] = []
  while (off < u8.length) {
    // If a new segment header starts here, skip it and continue
    if (off + 8 <= u8.length && dv.getUint32(off, true) === MAGIC && dv.getUint32(off + 4, true) === VERSION) {
      off = readHeader(off)
      if (off >= u8.length) break
    }
    const type = dv.getUint8(off); off += 1
    off += 1 // reserved
    const id = dv.getUint32(off, true); off += 4
    const metaLen = dv.getUint32(off, true); off += 4
    const vecLen = dv.getUint32(off, true); off += 4
    let meta: unknown | null = null
    if (metaLen > 0) {
      const mb = u8.subarray(off, off + metaLen); off += metaLen
      meta = JSON.parse(new TextDecoder().decode(mb))
    }
    if (type === 2) { out.push({ type: 'remove', id }); continue }
    if (type === 3) { out.push({ type: 'setMeta', id, meta }); continue }
    if (type === 1 && vecLen > 0) {
      const vb = u8.subarray(off, off + vecLen); off += vecLen
      const vector = new Float32Array(vb.buffer.slice(vb.byteOffset, vb.byteOffset + vb.byteLength))
      out.push({ type: 'upsert', id, vector, meta })
    } else {
      throw new Error('wal decode error: unknown type or missing vector')
    }
  }
  return out
}

/** Apply a WAL buffer to a VectorLite instance (idempotent upserts). */
export function applyWal<TMeta>(vl: VectorLiteState<TMeta>, walBytes: Uint8Array): void {
  const records = decodeWal(walBytes)
  for (const r of records) {
    if (r.type === 'remove') { remove(vl, r.id); continue }
    if (r.type === 'setMeta') { setMeta(vl, r.id, r.meta as TMeta | null); continue }
    add(vl, r.id, r.vector, r.meta as TMeta | null, { upsert: true })
  }
}

export type MetaToAttrs<TMeta> = (meta: TMeta | null) => Attrs | null

/**
 * Apply WAL and keep an attribute index in sync using a projector from meta to attrs.
 */
export function applyWalWithIndex<TMeta>(
  vl: VectorLiteState<TMeta>,
  walBytes: Uint8Array,
  index: AttrIndex,
  projector: MetaToAttrs<TMeta>
): void {
  const records = decodeWal(walBytes)
  for (const r of records) {
    if (r.type === 'remove') {
      remove(vl, r.id)
      index.removeId(r.id)
      continue
    }
    if (r.type === 'setMeta') {
      const meta = r.meta as TMeta | null
      setMeta(vl, r.id, meta)
      index.setAttrs(r.id, projector(meta))
      continue
    }
    // upsert
    const meta = r.meta as TMeta | null
    add(vl, r.id, r.vector, meta, { upsert: true })
    index.setAttrs(r.id, projector(meta))
  }
}
/**
 * WAL (Write-Ahead Log) for idempotent upserts/removals/meta changes.
 *
 * Why: Provide durable, append-only change recording that can be applied to a
 * fresh in-memory instance and optionally projected into attribute indices
 * without coupling to persistence backends.
 */
