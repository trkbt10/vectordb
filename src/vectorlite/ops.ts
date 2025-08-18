/**
 * Public operations on VectorLite state (size/has/add/remove/search, ...).
 *
 * Why: Keep day-to-day operations separate from creation and
 * (de)serialization for readability and testability.
 */
import type { SearchHit, SearchOptions, UpsertOptions } from '../types'
import { addOrUpdate, ensure as storeEnsure, get as storeGet, getByIndex as storeGetByIndex, has as storeHas, normalizeQuery, removeById, size as storeSize, updateMeta as storeUpdateMeta, createStore } from '../core/store'
import type { VectorLiteState } from './state'
import { bf_add, bf_remove, bf_search } from '../ann/bruteforce'
import { hnsw_add, hnsw_remove, hnsw_search, hnsw_ensureCapacity, createHNSWState } from '../ann/hnsw'
import { ivf_add, ivf_remove, ivf_search, createIVFState } from '../ann/ivf'
import type { BruteforceState } from '../ann/bruteforce'
import type { HNSWState } from '../ann/hnsw'
import { isHnswVL, isIvfVL } from '../util/guards'
import { createVectorLite } from './create'
import type { HNSWParams, IVFParams, VectorLiteOptions } from '../types'

export function size<TMeta>(vl: VectorLiteState<TMeta>) { return storeSize(vl.store) }
export function has<TMeta>(vl: VectorLiteState<TMeta>, id: number) { return storeHas(vl.store, id) }

export function add<TMeta>(vl: VectorLiteState<TMeta>, id: number, vector: Float32Array, meta: TMeta | null = null, up?: UpsertOptions) {
  const grew = storeEnsure(vl.store, 1)
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity)
  const { created } = addOrUpdate(vl.store, id, vector, meta, up)
  if (created) {
    if (isHnswVL(vl)) hnsw_add(vl.ann, vl.store, id)
    else if (isIvfVL(vl)) ivf_add(vl.ann, vl.store, id)
    else bf_add((vl.ann as BruteforceState), vl.store, id)
  }
}

export function addMany<TMeta>(vl: VectorLiteState<TMeta>, rows: { id: number; vector: Float32Array; meta?: TMeta | null }[], up?: UpsertOptions) {
  const grew = storeEnsure(vl.store, rows.length)
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity)
  for (const r of rows) add(vl, r.id, r.vector, r.meta ?? null, up)
}

export function getOne<TMeta>(vl: VectorLiteState<TMeta>, id: number) { return storeGet(vl.store, id) }
export const get = getOne
export function getMeta<TMeta>(vl: VectorLiteState<TMeta>, id: number): TMeta | null { const r = storeGet(vl.store, id); return r ? r.meta : null }
export function setMeta<TMeta>(vl: VectorLiteState<TMeta>, id: number, meta: TMeta | null): boolean { return storeUpdateMeta(vl.store, id, meta) }

export function remove<TMeta>(vl: VectorLiteState<TMeta>, id: number): boolean {
  if (isHnswVL(vl)) {
    if (!has(vl, id)) return false
    hnsw_remove(vl.ann, vl.store, id)
    return true
  }
  if (isIvfVL(vl)) {
    if (!has(vl, id)) return false
    ivf_remove(vl.ann, vl.store, id)
    return true
  }
  const res = removeById(vl.store, id); return res !== null
}

export function search<TMeta>(vl: VectorLiteState<TMeta>, query: Float32Array, options: SearchOptions<TMeta> = {}): SearchHit<TMeta>[] {
  const k = Math.max(1, options.k ?? 5)
  const q = normalizeQuery(vl.metric, query)
  if (isHnswVL(vl)) return hnsw_search(vl.ann, vl.store, q, { k, filter: options.filter })
  if (isIvfVL(vl)) return ivf_search(vl.ann, vl.store, q, k, options.filter)
  return bf_search((vl.ann as BruteforceState), vl.store, q, k, options.filter)
}

export function hnswCompactAndRebuild<TMeta>(vl: VectorLiteState<TMeta>): number {
  if (!isHnswVL(vl)) return 0
  const h = vl.ann
  const n = vl.store._count
  if (n === 0) return 0
  let alive = 0
  for (let i = 0; i < n; i++) { if (!h.tombstone[i]) alive++ }
  if (alive === n) return 0
  // Build a new store and HNSW state with alive entries only
  const newStore = createStore<TMeta>(vl.dim, vl.metric, alive || 1)
  const newH = createHNSWState({ M: h.M, efConstruction: h.efConstruction, efSearch: h.efSearch, levelMult: h.levelMult, allowReplaceDeleted: h.allowReplaceDeleted, seed: 42 }, vl.metric, alive || 1)
  for (let i = 0; i < n; i++) {
    if (h.tombstone[i]) continue
    const { id, vector, meta } = storeGetByIndex(vl.store, i)
    addOrUpdate(newStore, id, vector, meta, { upsert: false })
  }
  for (let i = 0; i < newStore._count; i++) {
    const id = newStore.ids[i]
    hnsw_add(newH, newStore, id)
  }
  vl.store = newStore
  vl.ann = newH
  return n - alive
}

/** Build a new instance with a chosen strategy using the same data (no auto switch). */
export function buildWithStrategy<TMeta>(vl: VectorLiteState<TMeta>, next: 'bruteforce' | 'hnsw' | 'ivf', params?: { hnsw?: HNSWParams; ivf?: IVFParams }): VectorLiteState<TMeta> {
  const opts: VectorLiteOptions = { dim: vl.dim, metric: vl.metric, capacity: vl.store._capacity, strategy: next, hnsw: params?.hnsw, ivf: params?.ivf }
  const out = createVectorLite<TMeta>(opts)
  for (let i = 0; i < vl.store._count; i++) {
    const id = vl.store.ids[i]
    const base = i * vl.dim
    const vec = vl.store.data.subarray(base, base + vl.dim)
    const meta = vl.store.metas[i]
    add(out, id, new Float32Array(vec), meta)
  }
  return out
}

export function buildHNSWFromStore<TMeta>(vl: VectorLiteState<TMeta>, params?: HNSWParams): VectorLiteState<TMeta> {
  return buildWithStrategy(vl, 'hnsw', { hnsw: params })
}

export function buildIVFFromStore<TMeta>(vl: VectorLiteState<TMeta>, params?: IVFParams): VectorLiteState<TMeta> {
  return buildWithStrategy(vl, 'ivf', { ivf: params })
}
