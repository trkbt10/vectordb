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
import type { BruteforceState } from '../ann/bruteforce'
import type { HNSWState } from '../ann/hnsw'
import { isHnswVL } from '../util/guards'

export function size<TMeta>(vl: VectorLiteState<TMeta>) { return storeSize(vl.store) }
export function has<TMeta>(vl: VectorLiteState<TMeta>, id: number) { return storeHas(vl.store, id) }

export function add<TMeta>(vl: VectorLiteState<TMeta>, id: number, vector: Float32Array, meta: TMeta | null = null, up?: UpsertOptions) {
  const grew = storeEnsure(vl.store, 1)
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity)
  const { created } = addOrUpdate(vl.store, id, vector, meta, up)
  if (created) {
    if (isHnswVL(vl)) hnsw_add(vl.ann, vl.store, id)
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
  const res = removeById(vl.store, id); return res !== null
}

export function search<TMeta>(vl: VectorLiteState<TMeta>, query: Float32Array, options: SearchOptions<TMeta> = {}): SearchHit<TMeta>[] {
  const k = Math.max(1, options.k ?? 5)
  const q = normalizeQuery(vl.metric, query)
  if (isHnswVL(vl)) return hnsw_search(vl.ann, vl.store, q, { k, filter: options.filter })
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
