import { Metric, SearchHit, SearchOptions, UpsertOptions, VectorLiteOptions } from './types'
import { CoreStore, createStore, get as storeGet, size as storeSize, has as storeHas, addOrUpdate, ensure as storeEnsure, removeById, normalizeQuery, restoreFromDeserialized, updateMeta as storeUpdateMeta, getIndex as storeGetIndex, getByIndex as storeGetByIndex } from './core/store'
import { createWriter, createReader } from './util/bin'
import { BruteforceState, bf_add, bf_remove, bf_search, bf_serialize, bf_deserialize, createBruteforceState } from './ann/bruteforce'
import { HNSWState, hnsw_add, hnsw_remove, hnsw_search, hnsw_serialize, hnsw_deserialize, createHNSWState, hnsw_ensureCapacity } from './ann/hnsw'
import { compilePredicate, preselectCandidates, type FilterExpr } from './filter/expr'
import type { AttrIndex } from './attr/index'
import { dotAt, l2negAt } from './util/math'
import { pushTopK } from './util/topk'

const MAGIC = 0x564c4954 // 'VLIT'
const VERSION_V1 = 1
const VERSION_V2 = 2

/**
 * Opaque VectorLite state. Use the exported functions (size/has/add/...) to operate on it.
 */
export type VectorLiteState<TMeta> = {
  dim: number
  metric: Metric
  store: CoreStore<TMeta>
  strategy: 'bruteforce' | 'hnsw'
  ann: BruteforceState | HNSWState
}

/**
 * Create a new VectorLite state.
 * - WASM安全・依存なしの純TS実装
 * - strategy: 'bruteforce'（小〜中規模に正確） or 'hnsw'（大規模に高速）
 */
export function createVectorLite<TMeta = unknown>(opts: VectorLiteOptions): VectorLiteState<TMeta> {
  const dim = opts.dim
  const metric: Metric = opts.metric ?? 'cosine'
  const store: CoreStore<TMeta> = createStore<TMeta>(dim, metric, opts.capacity ?? 1024)
  const strategy = (opts.strategy ?? 'bruteforce')
  const ann: BruteforceState | HNSWState = strategy === 'hnsw' ? createHNSWState(opts.hnsw ?? {}, metric, store._capacity) : createBruteforceState(metric)
  return { dim, metric, store, strategy, ann }
}

/** Return number of vectors stored. */
export function size<TMeta>(vl: VectorLiteState<TMeta>) { return storeSize(vl.store) }
/** Return whether id exists in the store. */
export function has<TMeta>(vl: VectorLiteState<TMeta>, id: number) { return storeHas(vl.store, id) }
/**
 * Add or update a vector.
 * - For cosine metric, vectors are normalized internally.
 * - Set opts.upsert=true to overwrite if id exists.
 */
export function add<TMeta>(vl: VectorLiteState<TMeta>, id: number, vector: Float32Array, meta: TMeta | null = null, up?: UpsertOptions) {
  const grew = storeEnsure(vl.store, 1)
  if (grew && vl.strategy === 'hnsw') hnsw_ensureCapacity(vl.ann as HNSWState, vl.store._capacity)
  const { created } = addOrUpdate(vl.store, id, vector, meta, up)
  if (created) {
    if (vl.strategy === 'hnsw') hnsw_add(vl.ann as HNSWState, vl.store, id)
    else bf_add(vl.ann as BruteforceState, vl.store, id)
  }
}
/** Bulk add helper. */
export function addMany<TMeta>(vl: VectorLiteState<TMeta>, rows: { id: number; vector: Float32Array; meta?: TMeta | null }[], up?: UpsertOptions) {
  const grew = storeEnsure(vl.store, rows.length)
  if (grew && vl.strategy === 'hnsw') hnsw_ensureCapacity(vl.ann as HNSWState, vl.store._capacity)
  for (const r of rows) add(vl, r.id, r.vector, r.meta ?? null, up)
}
/** Get a copy of vector+meta for id, or null. */
export function getOne<TMeta>(vl: VectorLiteState<TMeta>, id: number) { return storeGet(vl.store, id) }
export const get = getOne
/** KVS-style: get only meta for id (null if missing). */
export function getMeta<TMeta>(vl: VectorLiteState<TMeta>, id: number): TMeta | null { const r = storeGet(vl.store, id); return r ? r.meta : null }
/** KVS-style: set only meta for id. Returns boolean updated. */
export function setMeta<TMeta>(vl: VectorLiteState<TMeta>, id: number, meta: TMeta | null): boolean { return storeUpdateMeta(vl.store, id, meta) }
/**
 * Remove by id.
 * - bruteforce: compacts store in O(1)
 * - hnsw: marks tombstone (linksは保持)。再配線は将来拡張。
 */
export function remove<TMeta>(vl: VectorLiteState<TMeta>, id: number): boolean {
  if (vl.strategy === 'hnsw') {
    if (!has(vl, id)) return false
    hnsw_remove(vl.ann as HNSWState, vl.store, id)
    return true
  }
  const res = removeById(vl.store, id); return res !== null
}
/**
 * KNN search.
 * - cosine: 内部正規化してスコア=cosine相関
 * - l2: スコア=-L2距離（大きいほど近い）
 */
export function search<TMeta>(vl: VectorLiteState<TMeta>, query: Float32Array, options: SearchOptions<TMeta> = {}): SearchHit<TMeta>[] {
  const k = Math.max(1, options.k ?? 5)
  const q = normalizeQuery(vl.metric, query)
  return vl.strategy === 'hnsw'
    ? hnsw_search(vl.ann as HNSWState, vl.store, q, k, options.filter)
    : bf_search(vl.ann as BruteforceState, vl.store, q, k, options.filter)
}

/**
 * Search using a filter expression and optional attribute index.
 * - With bruteforce: if candidates are preselected from the index, only score those ids.
 * - With HNSW: uses built-in search with a filter predicate (cannot constrain exploration).
 */
export function searchWithExpr<TMeta>(
  vl: VectorLiteState<TMeta>,
  query: Float32Array,
  expr: FilterExpr,
  opts: { k?: number; index?: AttrIndex | null } = {}
): SearchHit<TMeta>[] {
  const k = Math.max(1, opts.k ?? 5)
  const q = normalizeQuery(vl.metric, query)
  const pred = compilePredicate(expr)
  const idx = opts.index ?? null
  const idxReader = idx ? {
    eq: (key: string, value: any) => idx.eq(key, value),
    exists: (key: string) => idx.exists(key),
    range: (key: string, r: any) => idx.range(key, r),
  } : null
  const candidates = preselectCandidates(expr, idxReader)

  if (vl.strategy === 'bruteforce' && candidates && candidates.size > 0) {
    const dim = vl.store.dim
    if (q.length !== dim) throw new Error(`dim mismatch: got ${q.length}, want ${dim}`)
    const out: SearchHit<TMeta>[] = []
    const data = vl.store.data
    for (const id of candidates) {
      const at = vl.store.pos.get(id)
      if (at === undefined) continue
      const meta = vl.store.metas[at]
      const attrs = idx ? idx.getAttrs(id) : null
      if (!pred(id, meta, attrs)) continue
      const base = at * dim
      const s = vl.metric === 'cosine' ? dotAt(data, base, q, dim) : l2negAt(data, base, q, dim)
      pushTopK(out, { id, score: s, meta }, k, (x) => x.score)
    }
    return out
  }
  // Fallback to built-in search with a filter capturing attrs
  const filter = (id: number, meta: TMeta | null) => {
    const attrs = idx ? idx.getAttrs(id) : null
    return pred(id, meta, attrs)
  }
  return search(vl, q, { k, filter })
}
/** Serialize to binary buffer (v2). */
export function serialize<TMeta>(vl: VectorLiteState<TMeta>): ArrayBuffer {
  const version = VERSION_V2
  const strategyCode = vl.strategy === 'hnsw' ? 1 : 0
  // header: magic(4) ver(4) metric(4) dim(4) count(4) strategy(4)
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
  const stratSeg = vl.strategy === 'hnsw' ? hnsw_serialize(vl.ann as HNSWState, vl.store) : bf_serialize(vl.ann as BruteforceState)
  const w = createWriter()
  w.pushBytes(new Uint8Array(header))
  w.pushU32(metaBytes.length); w.pushBytes(metaBytes)
  w.pushBytes(idsBytes)
  w.pushBytes(vecBytes)
  w.pushU32(stratSeg.byteLength); w.pushBytes(new Uint8Array(stratSeg))
  return w.concat().buffer as ArrayBuffer
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
  const stratLen = r.readU32(); const stratU8 = r.readBytes(stratLen); const stratBuf = stratU8.buffer.slice(stratU8.byteOffset, stratU8.byteOffset + stratU8.byteLength)

  const inst = createVectorLite<TMeta>({ dim, metric, capacity: count, strategy: strategyCode === 1 ? 'hnsw' : 'bruteforce' })
  inst.store.ids.set(ids); inst.store.data.set(data)
  for (let i = 0; i < count; i++) { inst.store.metas[i] = metaObj.metas[i] ?? null }
  restoreFromDeserialized(inst.store, count)
  if (strategyCode === 1) { hnsw_deserialize(inst.ann as HNSWState, inst.store, stratBuf) }
  return inst
}

/**
 * Compact and rebuild HNSW graph, removing tombstoned entries and
 * re-wiring the graph. For bruteforce, this is a no-op.
 * Returns number of removed/tombstoned items compacted away.
 */
export function hnswCompactAndRebuild<TMeta>(vl: VectorLiteState<TMeta>): number {
  if (vl.strategy !== 'hnsw') return 0
  const h = vl.ann as HNSWState
  const n = vl.store._count
  if (n === 0) return 0
  // Count alive
  let alive = 0
  for (let i = 0; i < n; i++) { if (!h.tombstone[i]) alive++ }
  if (alive === n) return 0
  // Build a new store and HNSW state with alive entries only
  const newStore: CoreStore<TMeta> = createStore<TMeta>(vl.dim, vl.metric, alive || 1)
  const newH = createHNSWState({ M: h.M, efConstruction: h.efConstruction, efSearch: h.efSearch, levelMult: h.levelMult, allowReplaceDeleted: h.allowReplaceDeleted, seed: 42 }, vl.metric, alive || 1)
  // Copy alive rows
  for (let i = 0; i < n; i++) {
    if (h.tombstone[i]) continue
    const { id, vector, meta } = storeGetByIndex(vl.store, i)
    addOrUpdate(newStore, id, vector, meta, { upsert: false })
  }
  // Rebuild HNSW links by re-adding in id order
  for (let i = 0; i < newStore._count; i++) {
    const id = newStore.ids[i]
    hnsw_add(newH, newStore, id)
  }
  // Swap in
  vl.store = newStore
  vl.ann = newH
  return n - alive
}
