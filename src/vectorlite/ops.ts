/**
 * Public operations on VectorLite state (size/has/add/remove/search, ...).
 *
 * Why: Keep day-to-day operations separate from creation and
 * (de)serialization for readability and testability.
 */
import type { SearchHit, SearchOptions, UpsertOptions } from '../types'
import { addOrUpdate, ensure as storeEnsure, get as storeGet, getByIndex as storeGetByIndex, has as storeHas, normalizeQuery, removeById, size as storeSize, updateMeta as storeUpdateMeta, createStore, shrinkToFit, resizeCapacity } from '../core/store'
import type { VectorLiteState } from './state'
import { bf_add, bf_remove, bf_search } from '../ann/bruteforce'
import { hnsw_add, hnsw_remove, hnsw_search, hnsw_ensureCapacity, createHNSWState } from '../ann/hnsw'
import { ivf_add, ivf_remove, ivf_search, createIVFState, ivf_trainCentroids, ivf_reassignLists, ivf_evaluate } from '../ann/ivf'
import type { BruteforceState } from '../ann/bruteforce'
import type { HNSWState } from '../ann/hnsw'
import { isHnswVL, isIvfVL } from '../util/guards'
import { createVectorLite } from './create'
import type { HNSWParams, IVFParams, VectorLiteOptions } from '../types'

export type HnswStats = { levels: number; avgDeg: number; tombstoneRatio?: number }
export type IvfStats = { nlist: number; nprobe: number; listSizeHist: number[] }
export type StatsOut = { n: number; dim: number; strategy: 'bruteforce'|'hnsw'|'ivf'; metric: 'cosine'|'l2'|'dot'; deletedRatio?: number; hnsw?: HnswStats; ivf?: IvfStats }

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
  // For IVF, seed centroids evenly across existing vectors to avoid biased first-n seeding
  if (next === 'ivf' && isIvfVL(out) && vl.store._count > 0) {
    const nlist = out.ann.nlist
    const dim = vl.dim
    const total = vl.store._count
    const cents = out.ann.centroids
    function norm(vec: Float32Array) {
      if (out.metric === 'l2') return
      let ss = 0
      for (let i = 0; i < vec.length; i++) ss += vec[i] * vec[i]
      const inv = ss > 0 ? 1 / Math.sqrt(ss) : 1
      for (let i = 0; i < vec.length; i++) vec[i] = vec[i] * inv
    }
    for (let c = 0; c < nlist; c++) {
      const idx = Math.min(total - 1, Math.floor((c + 0.5) * total / nlist))
      const base = idx * dim
      const seg = vl.store.data.subarray(base, base + dim)
      const tmp = new Float32Array(dim)
      tmp.set(seg)
      norm(tmp)
      cents.set(tmp, c * dim)
    }
    out.ann.centroidCount = nlist
  }
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

// -------- Bulk operations --------
export function upsertMany<TMeta>(vl: VectorLiteState<TMeta>, rows: { id: number; vector: Float32Array; meta?: TMeta | null }[], opts?: UpsertOptions & { mode?: 'best_effort' | 'all_or_nothing' }) {
  const res = { ok: 0, failed: 0, duplicates: [] as number[], errors: [] as { id: number; reason: string }[] }
  const mode = opts?.mode ?? 'best_effort'
  try {
    for (const r of rows) {
      try { add(vl, r.id, r.vector, r.meta ?? null, { upsert: true }); res.ok++ }
      catch (e: any) { res.failed++; res.errors.push({ id: r.id, reason: String(e?.message ?? e) }) }
    }
    if (mode === 'all_or_nothing' && res.failed > 0) {
      throw new Error(`upsertMany failed for ${res.failed}/${rows.length}`)
    }
  } catch (e) {}
  return res
}

export function removeMany<TMeta>(vl: VectorLiteState<TMeta>, ids: number[], opts?: { ignoreMissing?: boolean }) {
  const res = { ok: 0, missing: [] as number[] }
  for (const id of ids) {
    const ok = remove(vl, id)
    if (ok) res.ok++
    else if (!opts?.ignoreMissing) res.missing.push(id)
  }
  return res
}

// -------- Stats / Diagnose --------
export function stats<TMeta>(vl: VectorLiteState<TMeta>): StatsOut {
  const out: StatsOut = { n: vl.store._count, dim: vl.dim, strategy: vl.strategy, metric: vl.metric }
  if (isHnswVL(vl)) {
    const h = vl.ann
    const levels = Math.max(0, h.maxLevel)
    let edges = 0
    const nodes = vl.store._count
    for (let l = 0; l <= levels; l++) {
      const layer = h.links[l] || []
      for (let i = 0; i < layer.length; i++) edges += (layer[i]?.length || 0)
    }
    let dead = 0
    for (let i = 0; i < nodes; i++) if (h.tombstone[i] === 1) dead++
    const tomb = nodes ? (dead / nodes) : 0
    out.hnsw = { levels, avgDeg: nodes ? (edges / Math.max(1, nodes)) : 0, tombstoneRatio: tomb }
    out.deletedRatio = tomb
  } else if (isIvfVL(vl)) {
    const lists = vl.ann.lists
    const sizes = lists.map(a => a.length)
    out.ivf = { nlist: vl.ann.nlist, nprobe: vl.ann.nprobe, listSizeHist: sizes }
    out.deletedRatio = 0
  }
  return out
}

export function diagnose<TMeta>(vl: VectorLiteState<TMeta>, opts?: { sampleQueries?: Float32Array[]; k?: number }): { stats: StatsOut; suggestions: string[]; recallEstimate?: number; hotspots?: string[] } {
  const s = stats(vl)
  const suggestions: string[] = []
  const hotspots: string[] = []
  if (vl.strategy === 'bruteforce' && s.n >= 10000) suggestions.push('Large dataset on BF; consider HNSW/IVF for latency. (manual build)')
  if (isHnswVL(vl)) {
    if ((s.hnsw?.avgDeg ?? 0) < 4) suggestions.push('HNSW avgDeg is low; consider increasing M or efConstruction.')
    if ((s.hnsw?.tombstoneRatio ?? 0) > 0.3) suggestions.push('HNSW tombstone high; consider compaction.')
  }
  if (isIvfVL(vl)) {
    const arr: number[] = s.ivf ? s.ivf.listSizeHist : []
    const avg = arr.reduce((x:number,y:number)=>x+y,0)/Math.max(1,arr.length)
    if (arr.some(x => x > 2*avg)) {
      suggestions.push('IVF list imbalance detected; consider retraining centroids (k-means).')
      const maxIdx = arr.reduce((bi, v, i, a) => v > a[bi] ? i : bi, 0)
      hotspots.push(`ivf.list[${maxIdx}] size=${arr[maxIdx]}`)
    }
  }
  let recallEstimate: number | undefined
  const qs = opts?.sampleQueries
  if (qs && qs.length > 0) {
    const k = Math.max(1, opts?.k ?? 5)
    // quick estimate: compare current search vs bruteforce on sample
    let acc = 0
    for (const q of qs) {
      const bf = search(vl, q, { k, filter: undefined }) // if strategy is BF this equals below
      const res = search(vl, q, { k, filter: undefined })
      const truth = new Set(bf.map(h => h.id))
      let inter = 0
      for (const h of res) if (truth.has(h.id)) inter++
      acc += inter / k
    }
    recallEstimate = acc / qs.length
  }
  return { stats: s, suggestions, recallEstimate, hotspots: hotspots.length ? hotspots : undefined }
}

// -------- Consistency Check / Repair --------
export function checkConsistency<TMeta>(vl: VectorLiteState<TMeta>) {
  const missingInIndex: number[] = []
  const missingInStore: number[] = []
  const mismatchedPos: number[] = []
  if (isIvfVL(vl)) {
    const idToList = vl.ann.idToList
    for (let i = 0; i < vl.store._count; i++) {
      const id = vl.store.ids[i]
      if (!idToList.has(id)) missingInIndex.push(id)
    }
  }
  if (isHnswVL(vl)) {
    for (let i = 0; i < vl.store._count; i++) {
      const id = vl.store.ids[i]
      const at = vl.store.pos.get(id)
      if (at !== i) mismatchedPos.push(id)
    }
  }
  return { missingInIndex, missingInStore, mismatchedPos }
}

export function repairConsistency<TMeta>(vl: VectorLiteState<TMeta>, opts?: { fixIndex?: boolean; fixStore?: boolean }) {
  const report = checkConsistency(vl)
  if (opts?.fixIndex) {
    if (isIvfVL(vl)) {
      vl.ann.idToList.clear()
      for (const lst of vl.ann.lists) lst.splice(0, lst.length)
      for (let i = 0; i < vl.store._count; i++) {
        ivf_add(vl.ann, vl.store, vl.store.ids[i])
      }
    }
  }
  return report
}

// -------- IVF retraining / evaluation --------
/** Train IVF centroids using current store vectors. */
export function trainIvfCentroids<TMeta>(vl: VectorLiteState<TMeta>, opts?: { iters?: number; seed?: number }): { updated: number } {
  if (!isIvfVL(vl)) return { updated: 0 }
  return ivf_trainCentroids(vl.ann, vl.store, opts ?? {})
}

/** Reassign all ids to IVF posting lists based on current centroids. */
export function reassignIvfLists<TMeta>(vl: VectorLiteState<TMeta>): { moved: number } {
  if (!isIvfVL(vl)) return { moved: 0 }
  return ivf_reassignLists(vl.ann, vl.store)
}

/** Evaluate IVF quality vs bruteforce on provided queries. */
export function evaluateIvf<TMeta>(vl: VectorLiteState<TMeta>, queries: Float32Array[], k: number): { recall: number; latency: number } {
  if (!isIvfVL(vl)) return { recall: 0, latency: 0 }
  return ivf_evaluate(vl.ann, vl.store, queries, k)
}

// -------- Compaction / Rebuild --------
export function compactStore<TMeta>(vl: VectorLiteState<TMeta>, opts?: { shrink?: boolean; tombstoneRatio?: number; capacity?: number }): { shrunk: boolean; rebuilt: number } {
  let rebuilt = 0
  const ratio = opts?.tombstoneRatio
  if (isHnswVL(vl) && typeof ratio === 'number') {
    const h = vl.ann
    const n = vl.store._count
    let dead = 0
    for (let i = 0; i < n; i++) if (h.tombstone[i] === 1) dead++
    if (n > 0 && dead / n > ratio) {
      rebuilt = hnswCompactAndRebuild(vl)
    }
  }
  let shrunk = false
  if (typeof opts?.capacity === 'number') {
    resizeCapacity(vl.store, opts.capacity)
    shrunk = true
  } else if (opts?.shrink) {
    shrinkToFit(vl.store)
    shrunk = true
  }
  return { shrunk, rebuilt }
}

export function rebuildIndex<TMeta>(vl: VectorLiteState<TMeta>, opts: { strategy: 'hnsw' | 'ivf'; params?: HNSWParams | IVFParams; ids?: number[] }): number {
  const ids = opts.ids && opts.ids.length ? Array.from(opts.ids) : null
  if (opts.strategy === 'hnsw') {
    const old = isHnswVL(vl) ? vl.ann : null
    const p = (opts.params as HNSWParams | undefined) ?? (old ? { M: old.M, efConstruction: old.efConstruction, efSearch: old.efSearch, levelMult: old.levelMult, allowReplaceDeleted: old.allowReplaceDeleted, seed: 42 } : { M: 16, efConstruction: 200, efSearch: 50 })
    const newH = createHNSWState(p, vl.metric, vl.store._count || 1)
    // replace state
    vl.strategy = 'hnsw'
    vl.ann = newH
    if (isHnswVL(vl)) {
      // add all or subset
      if (!ids) {
        for (let i = 0; i < vl.store._count; i++) hnsw_add(vl.ann, vl.store, vl.store.ids[i])
      } else {
        for (const id of ids) hnsw_add(vl.ann, vl.store, id)
      }
    }
    return ids ? ids.length : vl.store._count
  }
  // IVF
  if (opts.strategy === 'ivf') {
    const dim = vl.dim
    const old = isIvfVL(vl) ? vl.ann : null
    const nextParams = (opts.params as IVFParams | undefined) ?? (old ? { nlist: old.nlist, nprobe: old.nprobe } : { nlist: 64, nprobe: 8 })
    const needRecreate = !old || (typeof nextParams.nlist === 'number' && nextParams.nlist !== old.nlist)
    if (needRecreate) {
      const newI = createIVFState(nextParams, vl.metric, dim)
      vl.strategy = 'ivf'
      vl.ann = newI
    } else if (old && typeof nextParams.nprobe === 'number') {
      old.nprobe = Math.max(1, Math.min(old.nlist, nextParams.nprobe))
    }
    if (isIvfVL(vl)) {
      const trained = ivf_trainCentroids(vl.ann, vl.store)
      if (!ids) {
        ivf_reassignLists(vl.ann, vl.store)
        return trained.updated
      }
      // partial reassign for provided ids
      for (const id of ids) {
        const at = vl.store.pos.get(id)
        if (at === undefined) continue
        const li = vl.ann.idToList.get(id)
        if (li !== undefined) {
          const arr = vl.ann.lists[li]
          const pos = arr.indexOf(id)
          if (pos >= 0) arr.splice(pos, 1)
        }
        ivf_add(vl.ann, vl.store, id)
      }
      return ids.length
    }
    return 0
  }
  return 0
}

// -------- HNSW tuning (suggestions only) --------
export type HnswTuneGrid = { efSearch?: number[]; M?: number[] }
export type HnswTuneResult = { params: { M: number; efSearch: number }; recall: number; latency: number }

/**
 * Evaluate HNSW parameter grid and return ranked suggestions (no auto-apply).
 * - efSearch: evaluated by temporarily setting on the instance (restored after)
 * - M: evaluated by building a temporary HNSW graph using current data
 */
export function tuneHnsw<TMeta>(vl: VectorLiteState<TMeta>, grid: HnswTuneGrid, queries: Float32Array[], k: number): HnswTuneResult[] {
  if (!isHnswVL(vl)) return []
  const efList = (grid.efSearch && grid.efSearch.length ? grid.efSearch : [vl.ann.efSearch]).map(x => Math.max(1, x|0))
  const MList = (grid.M && grid.M.length ? grid.M : [vl.ann.M]).map(x => Math.max(1, x|0))
  const bfTopK = (q: Float32Array, kk: number): Set<number> => new Set(search(buildWithStrategy(vl, 'bruteforce'), q, { k: kk }).map(h => h.id))
  const results: HnswTuneResult[] = []
  for (const M of MList) {
    const cand = (M === vl.ann.M) ? vl : buildHNSWFromStore(vl, { M, efConstruction: vl.ann.efConstruction, efSearch: vl.ann.efSearch })
    const origEf = (cand.strategy === 'hnsw') ? cand.ann.efSearch : 0
    for (const ef of efList) {
      if (cand.strategy === 'hnsw') cand.ann.efSearch = ef
      let sumR = 0
      let sumL = 0
      for (const q of queries) {
        const t0 = Date.now()
        const got = search(cand, q, { k })
        const dt = Date.now() - t0
        sumL += dt
        const truth = bfTopK(q, k)
        let inter = 0
        for (const h of got) if (truth.has(h.id)) inter++
        sumR += inter / k
      }
      if (cand.strategy === 'hnsw') cand.ann.efSearch = origEf
      results.push({ params: { M, efSearch: ef }, recall: sumR / Math.max(1, queries.length), latency: sumL / Math.max(1, queries.length) })
    }
  }
  results.sort((a,b)=> (b.recall - a.recall) || (a.latency - b.latency))
  return results
}
