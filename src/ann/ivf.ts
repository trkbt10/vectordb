import { CoreStore } from '../core/store'
import { Metric, SearchHit } from '../types'
import { getScoreAtFn } from '../util/similarity'

export type IVFParams = {
  nlist?: number
  nprobe?: number
}

export type IVFState = {
  type: 'ivf'
  metric: Metric
  nlist: number
  nprobe: number
  centroidCount: number
  centroids: Float32Array // length = nlist * dim (dim is store.dim)
  lists: Array<number[]> // posting lists of ids
  idToList: Map<number, number>
}

export function createIVFState(params: IVFParams, metric: Metric, dim: number): IVFState {
  const nlist = Math.max(1, params.nlist ?? 64)
  const nprobe = Math.max(1, Math.min(nlist, params.nprobe ?? Math.ceil(Math.sqrt(nlist))))
  return {
    type: 'ivf',
    metric,
    nlist,
    nprobe,
    centroidCount: 0,
    centroids: new Float32Array(nlist * dim),
    lists: new Array(nlist).fill(0).map(() => []),
    idToList: new Map<number, number>(),
  }
}

function nearestCentroid(h: IVFState, store: CoreStore<any>, vec: Float32Array): number {
  const dim = store.dim
  const scoreAt = getScoreAtFn(h.metric)
  let best = -1
  let bestScore = -Infinity
  const baseC = h.centroids
  const count = Math.max(1, h.centroidCount)
  for (let c = 0; c < count; c++) {
    const base = c * dim
    const sc = scoreAt(baseC, base, vec, dim)
    if (sc > bestScore) { bestScore = sc; best = c }
  }
  return best >>> 0
}

export function ivf_add<TMeta>(h: IVFState, store: CoreStore<TMeta>, id: number): void {
  const idx = (store.pos.get(id >>> 0) ?? -1)
  if (idx < 0) return
  const base = idx * store.dim
  const vec = store.data.subarray(base, base + store.dim)
  // Initialize centroids with first nlist vectors
  if (h.centroidCount < h.nlist) {
    const c = h.centroidCount
    h.centroids.set(vec, c * store.dim)
    h.centroidCount++
    h.lists[c].push(id >>> 0)
    h.idToList.set(id >>> 0, c)
    return
  }
  const c = nearestCentroid(h, store, vec)
  h.lists[c].push(id >>> 0)
  h.idToList.set(id >>> 0, c)
}

export function ivf_remove<TMeta>(h: IVFState, _store: CoreStore<TMeta>, id: number): void {
  const uid = id >>> 0
  const li = h.idToList.get(uid)
  if (li === undefined) return
  const arr = h.lists[li]
  const pos = arr.indexOf(uid)
  if (pos >= 0) arr.splice(pos, 1)
  h.idToList.delete(uid)
}

export function ivf_search<TMeta>(
  h: IVFState,
  store: CoreStore<TMeta>,
  q: Float32Array,
  k: number,
  filter?: (id: number, meta: TMeta | null) => boolean
): SearchHit<TMeta>[] {
  const dim = store.dim
  if (q.length !== dim) {
    throw new Error(`dim mismatch: got ${q.length}, want ${dim}`)
  }
  const scoreAt = getScoreAtFn(h.metric)
  // Pick nprobe centroids by score
  const scores: Array<{ c: number; s: number }> = []
  const count = Math.max(1, h.centroidCount)
  for (let c = 0; c < count; c++) {
    const s = scoreAt(h.centroids, c * dim, q, dim)
    scores.push({ c, s })
  }
  scores.sort((a, b) => b.s - a.s)
  const probe = Math.min(h.nprobe, scores.length)
  const out: SearchHit<TMeta>[] = []
  for (let i = 0; i < probe; i++) {
    const list = h.lists[scores[i]!.c]
    for (const id of list) {
      const at = store.pos.get(id)
      if (at === undefined) continue
      const meta = store.metas[at]
      if (filter && !filter(id, meta)) continue
      const base = at * dim
      const s = scoreAt(store.data, base, q, dim)
      // simple insert sort for k (small k)
      let ins = out.length
      for (let j = 0; j < out.length; j++) { if (s > out[j]!.score) { ins = j; break } }
      out.splice(ins, 0, { id, score: s, meta })
      if (out.length > k) out.length = k
    }
  }
  return out
}

export function ivf_serialize(h: IVFState, store: CoreStore<unknown>): ArrayBuffer {
  const dim = store.dim
  const header = new Uint32Array([h.nlist >>> 0, h.nprobe >>> 0, h.centroidCount >>> 0, dim >>> 0])
  const listsData = JSON.stringify(h.lists)
  const listsBytes = new TextEncoder().encode(listsData)
  const centBytes = new Uint8Array(h.centroids.buffer.slice(0))
  const out = new Uint8Array(16 + 4 + listsBytes.length + centBytes.length)
  out.set(new Uint8Array(header.buffer), 0)
  new DataView(out.buffer).setUint32(16, listsBytes.length >>> 0, true)
  out.set(listsBytes, 20)
  out.set(centBytes, 20 + listsBytes.length)
  return out.buffer
}

export function ivf_deserialize(h: IVFState, store: CoreStore<unknown>, buf: ArrayBuffer): void {
  const dv = new DataView(buf)
  const nlist = dv.getUint32(0, true)
  const nprobe = dv.getUint32(4, true)
  const ccount = dv.getUint32(8, true)
  const dim = dv.getUint32(12, true)
  const listsLen = dv.getUint32(16, true)
  const listsBytes = new Uint8Array(buf, 20, listsLen)
  const lists = JSON.parse(new TextDecoder().decode(listsBytes)) as number[][]
  const centStart = 20 + listsLen
  const centBytes = new Uint8Array(buf, centStart)
  const cent = new Float32Array(centBytes.buffer.slice(centBytes.byteOffset, centBytes.byteOffset + centBytes.byteLength))
  h.nlist = nlist
  h.nprobe = nprobe
  h.centroidCount = ccount
  h.centroids = cent
  h.lists = lists
  h.idToList.clear()
  for (let li = 0; li < lists.length; li++) {
    for (const id of lists[li]!) h.idToList.set(id >>> 0, li)
  }
  if (cent.length !== nlist * dim) {
    // Resize to fit current dim even if serialized dim differs
    const fixed = new Float32Array(nlist * store.dim)
    fixed.set(cent.subarray(0, Math.min(cent.length, fixed.length)))
    h.centroids = fixed
  }
}

