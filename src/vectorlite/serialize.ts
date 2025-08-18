/**
 * Serialization and deserialization for VectorLite state.
 *
 * Why: Keep binary formats and (de)serialization details isolated so they can
 * evolve without entangling operational logic.
 */
import { createReader, createWriter } from '../util/bin'
import type { Metric } from '../types'
import { createVectorLite } from './create'
import type { VectorLiteState } from './state'
import { hnsw_serialize, hnsw_deserialize } from '../ann/hnsw'
import { bf_serialize } from '../ann/bruteforce'
import { ivf_serialize, ivf_deserialize } from '../ann/ivf'
import { restoreFromDeserialized } from '../core/store'
import { isHnswVL, isBfVL, isIvfVL } from '../util/guards'

function serializeAnnStrategy<TMeta>(vl: VectorLiteState<TMeta>): ArrayBuffer {
  if (isHnswVL(vl)) return hnsw_serialize(vl.ann, vl.store)
  if (isBfVL(vl)) return bf_serialize(vl.ann)
  if (isIvfVL(vl)) return ivf_serialize(vl.ann, vl.store)
  throw new Error(`Unsupported strategy in serialize: ${String(vl.strategy)}`)
}

const MAGIC = 0x564c4954 // 'VLIT'
const VERSION_V1 = 1
const VERSION_V2 = 2

export function serialize<TMeta>(vl: VectorLiteState<TMeta>): ArrayBuffer {
  const version = VERSION_V2
  const strategyCode = vl.strategy === 'hnsw' ? 1 : (vl.strategy === 'ivf' ? 2 : 0)
  const header = new ArrayBuffer(24)
  const h = new DataView(header)
  h.setUint32(0, MAGIC, true)
  h.setUint32(4, version, true)
  h.setUint32(8, vl.metric === 'cosine' ? 0 : 1, true)
  h.setUint32(12, vl.dim, true)
  h.setUint32(16, vl.store._count, true)
  h.setUint32(20, strategyCode, true)

  const metaObj = {
    metas: vl.store.metas.slice(0, vl.store._count) as (TMeta | null)[],
    ids: Array.from(vl.store.ids.subarray(0, vl.store._count))
  }
  const metaBytes = new TextEncoder().encode(JSON.stringify(metaObj))
  const idsBytes = new Uint8Array(new Uint32Array(metaObj.ids).buffer)
  const vecView = vl.store.data.subarray(0, vl.store._count * vl.dim)
  const vecBytes = new Uint8Array(vecView.buffer, vecView.byteOffset, vecView.byteLength)
  const stratSeg = serializeAnnStrategy(vl)
  const w = createWriter()
  w.pushBytes(new Uint8Array(header))
  w.pushU32(metaBytes.length); w.pushBytes(metaBytes)
  w.pushBytes(idsBytes)
  w.pushBytes(vecBytes)
  w.pushU32(stratSeg.byteLength); w.pushBytes(new Uint8Array(stratSeg))
  return w.concat().buffer as ArrayBuffer
}

// Snapshot helpers (non-breaking wrappers)
type Hasher = (u8: Uint8Array) => Promise<string> | string
function isPromise<T>(x: unknown): x is Promise<T> { return !!x && typeof (x as { then?: unknown }).then === 'function' }

export function serializeFull<TMeta>(vl: VectorLiteState<TMeta>, opts?: { hasher?: Hasher }): Promise<{ data: ArrayBuffer; checksum?: string }> | { data: ArrayBuffer; checksum?: string } {
  const data = serialize(vl)
  const u8 = new Uint8Array(data)
  if (!opts?.hasher) return { data }
  const res = opts.hasher(u8)
  if (isPromise<string>(res)) {
    return res.then(cs => ({ data, checksum: cs }))
  }
  return { data, checksum: res }
}

import { applyWal } from '../wal'

export function serializeDelta<TMeta>(_vl: VectorLiteState<TMeta>, walBytes: Uint8Array, opts?: { hasher?: Hasher }): Promise<{ data: Uint8Array; checksum?: string }> | { data: Uint8Array; checksum?: string } {
  const data = walBytes
  if (!opts?.hasher) return { data }
  const res = opts.hasher(data)
  if (isPromise<string>(res)) {
    return res.then(cs => ({ data, checksum: cs }))
  }
  return { data, checksum: res }
}

export function mergeSnapshotWithDelta<TMeta>(base: ArrayBuffer, walBytes: Uint8Array): ArrayBuffer {
  const inst = deserializeVectorLite<TMeta>(base)
  applyWal(inst, walBytes)
  return serialize(inst)
}

export function deserializeVectorLite<TMeta = unknown>(buf: ArrayBuffer): VectorLiteState<TMeta> {
  const dv = new DataView(buf)
  const magic = dv.getUint32(0, true)
  if (magic !== MAGIC) throw new Error('bad magic')
  const version = dv.getUint32(4, true)
  const metricCode = dv.getUint32(8, true)
  const dim = dv.getUint32(12, true)
  const count = dv.getUint32(16, true)
  const metric: Metric = metricCode === 0 ? 'cosine' : 'l2'
  if (version === VERSION_V1) {
    const u8 = new Uint8Array(buf)
    const metaLen = new DataView(buf, 20, 4).getUint32(0, true)
    const metaStart = 24
    const metaEnd = metaStart + metaLen
    const metaObj = JSON.parse(new TextDecoder().decode(u8.subarray(metaStart, metaEnd))) as { metas: (TMeta | null)[]; ids: number[] }
    const idsStart = metaEnd
    const idsEnd = idsStart + count * 4
    const ids = new Uint32Array(buf.slice(idsStart, idsEnd))
    const vecStart = idsEnd
    const vecEnd = vecStart + count * dim * 4
    const data = new Float32Array(buf.slice(vecStart, vecEnd))
    const inst = createVectorLite<TMeta>({ dim, metric, capacity: count, strategy: 'bruteforce' })
    inst.store.ids.set(ids); inst.store.data.set(data)
    for (let i = 0; i < count; i++) { inst.store.metas[i] = metaObj.metas[i] ?? null }
    restoreFromDeserialized(inst.store, count)
    return inst
  }
  if (version !== VERSION_V2) throw new Error(`unsupported version ${version}`)
  const strategyCode = dv.getUint32(20, true)
  const r = createReader(buf.slice(24))
  const metaLen = r.readU32(); const metaBytes = r.readBytes(metaLen)
  const metaObj = JSON.parse(new TextDecoder().decode(metaBytes)) as { metas: (TMeta | null)[]; ids: number[] }
  const idsBytes = r.readBytes(count * 4); const ids = new Uint32Array(idsBytes.buffer)
  const vecBytes = r.readBytes(count * dim * 4); const data = new Float32Array(vecBytes.buffer)
  const stratLen = r.readU32(); const stratU8 = r.readBytes(stratLen); const stratBuf = stratU8.slice().buffer as ArrayBuffer

  const inst = createVectorLite<TMeta>({ dim, metric, capacity: count, strategy: strategyCode === 1 ? 'hnsw' : (strategyCode === 2 ? 'ivf' : 'bruteforce') })
  inst.store.ids.set(ids); inst.store.data.set(data)
  for (let i = 0; i < count; i++) { inst.store.metas[i] = metaObj.metas[i] ?? null }
  restoreFromDeserialized(inst.store, count)
  if (isHnswVL(inst)) { hnsw_deserialize(inst.ann, inst.store, stratBuf) }
  else if (isIvfVL(inst)) { ivf_deserialize(inst.ann, inst.store, stratBuf) }
  return inst
}
