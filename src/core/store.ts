import { Metric, UpsertOptions } from '../types'
import { normalizeVectorInPlace } from '../util/math'

export interface CoreStore<TMeta = unknown> {
  readonly dim: number
  readonly metric: Metric
  ids: Uint32Array
  data: Float32Array
  metas: (TMeta | null)[]
  pos: Map<number, number>
  _capacity: number
  _count: number
}

export function createStore<TMeta = unknown>(dim: number, metric: Metric, capacity = 1024): CoreStore<TMeta> {
  if (!Number.isInteger(dim) || dim <= 0) {
    throw new Error('dim must be positive integer')
  }
  const cap = Math.max(1, capacity)
  return {
    dim,
    metric,
    ids: new Uint32Array(cap),
    data: new Float32Array(cap * dim),
    metas: new Array(cap).fill(null),
    pos: new Map<number, number>(),
    _capacity: cap,
    _count: 0,
  }
}

export function size<T>(s: CoreStore<T>) { return s._count }
export function capacity<T>(s: CoreStore<T>) { return s._capacity }
export function has<T>(s: CoreStore<T>, id: number) { return s.pos.has(id >>> 0) }

export function ensure<T>(s: CoreStore<T>, extra = 1): boolean {
  if (s._count + extra <= s._capacity) {
    return false
  }
  let newCap = s._capacity
  while (newCap < s._count + extra) {
    newCap <<= 1
  }
  const ids2 = new Uint32Array(newCap)
  ids2.set(s.ids.subarray(0, s._count))
  const data2 = new Float32Array(newCap * s.dim)
  data2.set(s.data.subarray(0, s._count * s.dim))
  const metas2 = new Array(newCap).fill(null) as (T | null)[]
  for (let i = 0; i < s._count; i++) {
    metas2[i] = s.metas[i]
  }
  s.ids = ids2
  s.data = data2
  s.metas = metas2
  s._capacity = newCap
  return true
}

export function writeVectorAt<T>(s: CoreStore<T>, index: number, vector: Float32Array) {
  const base = index * s.dim
  const dst = s.data.subarray(base, base + s.dim)
  dst.set(vector)
  if (s.metric === 'cosine') {
    normalizeVectorInPlace(dst)
  }
}

export function getIndex<T>(s: CoreStore<T>, id: number) { return s.pos.get(id >>> 0) }

export function getByIndex<T>(s: CoreStore<T>, index: number): { vector: Float32Array; meta: T | null; id: number } {
  const base = index * s.dim
  return { vector: s.data.slice(base, base + s.dim), meta: s.metas[index], id: s.ids[index] }
}

export function get<T>(s: CoreStore<T>, id: number): { vector: Float32Array; meta: T | null } | null {
  const at = getIndex(s, id)
  if (at === undefined) {
    return null
  }
  const base = at * s.dim
  return { vector: s.data.slice(base, base + s.dim), meta: s.metas[at] }
}

/** Update only the meta by id. Returns true if updated, false if id missing. */
export function updateMeta<T>(s: CoreStore<T>, id: number, meta: T | null): boolean {
  const at = getIndex(s, id)
  if (at === undefined) return false
  s.metas[at] = meta
  return true
}

export function addOrUpdate<T>(s: CoreStore<T>, id: number, vector: Float32Array, meta: T | null = null, opts?: UpsertOptions): { index: number, created: boolean } {
  if (vector.length !== s.dim) {
    throw new Error(`dim mismatch: got ${vector.length}, want ${s.dim}`)
  }
  const uid = id >>> 0
  const at = s.pos.get(uid)
  if (at !== undefined) {
    if (!opts?.upsert) {
      throw new Error(`id ${uid} already exists`)
    }
    writeVectorAt(s, at, vector)
    s.metas[at] = meta
    return { index: at, created: false }
  }
  ensure(s, 1)
  const idx = s._count
  s.ids[idx] = uid
  s.metas[idx] = meta
  s.pos.set(uid, idx)
  writeVectorAt(s, idx, vector)
  s._count++
  return { index: idx, created: true }
}

export function removeById<T>(s: CoreStore<T>, id: number): { movedId?: number; movedFrom?: number; movedTo?: number } | null {
  const uid = id >>> 0
  const at = s.pos.get(uid)
  if (at === undefined) {
    return null
  }
  const last = s._count - 1
  if (at !== last) {
    s.ids[at] = s.ids[last]
    s.metas[at] = s.metas[last]
    const src = s.data.subarray(last * s.dim, (last + 1) * s.dim)
    s.data.set(src, at * s.dim)
    const movedId = s.ids[at]
    s.pos.set(movedId, at)
    s.pos.delete(uid)
    s._count--
    return { movedId, movedFrom: last, movedTo: at }
  } else {
    s.pos.delete(uid)
    s._count--
    return {}
  }
}

export function normalizeQuery(metric: Metric, q: Float32Array): Float32Array {
  if (metric !== 'cosine') {
    return q
  }
  const out = q.slice()
  normalizeVectorInPlace(out)
  return out
}

export function restoreFromDeserialized<T>(s: CoreStore<T>, count: number) {
  if (!Number.isInteger(count) || count < 0 || count > s._capacity) {
    throw new Error('invalid restore count')
  }
  s.pos.clear()
  for (let i = 0; i < count; i++) {
    s.pos.set(s.ids[i], i)
  }
  s._count = count
}
