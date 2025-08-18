// Attribute store and pluggable index strategies
import type { Range, Scalar } from '../filter/expr'

export type AttrValue = string | number | boolean | (string | number)[] | null
export type Attrs = Record<string, AttrValue>

export interface AttrIndex {
  strategy: string
  setAttrs(id: number, attrs: Attrs | null): void
  getAttrs(id: number): Attrs | null
  removeId(id: number): void
  eq(key: string, value: Scalar): Set<number> | null
  exists(key: string): Set<number> | null
  range(key: string, r: Range): Set<number> | null
}

// Basic strategy implementation (current behavior)
type NumEntry = { v: number; id: number }
class BasicAttrIndex implements AttrIndex {
  strategy = 'basic'
  private data = new Map<number, Attrs>()
  private eqMap = new Map<string, Map<string, Set<number>>>()
  private existsMap = new Map<string, Set<number>>()
  private numMap = new Map<string, { arr: NumEntry[]; dirty: boolean }>()

  setAttrs(id: number, attrs: Attrs | null): void {
    const uid = id >>> 0
    this.removeId(uid)
    if (!attrs) return
    for (const [k, v] of Object.entries(attrs)) {
      this.addOrRemoveValue('add', k, v as AttrValue, uid)
    }
    this.data.set(uid, attrs)
  }

  getAttrs(id: number): Attrs | null { return this.data.get(id >>> 0) ?? null }

  removeId(id: number): void {
    const uid = id >>> 0
    const old = this.data.get(uid)
    if (!old) return
    for (const [k, val] of Object.entries(old)) {
      if (val === null || val === undefined) { this.delExists(k, uid); continue }
      this.addOrRemoveValue('del', k, val as AttrValue, uid)
    }
    this.data.delete(uid)
  }

  eq(key: string, value: Scalar): Set<number> | null {
    const m = this.eqMap.get(key); if (!m) return null
    const s = m.get(typeof value + ':' + String(value))
    return s ? new Set(s) : null
  }
  exists(key: string): Set<number> | null {
    const s = this.existsMap.get(key); return s ? new Set(s) : null
  }
  range(key: string, r: Range): Set<number> | null {
    const e = this.numMap.get(key); if (!e) return null
    this.ensureSorted(e)
    const arr = e.arr
    if (arr.length === 0) return new Set()
    let lo = 0
    if (r.gt !== undefined || r.gte !== undefined) {
      const x = r.gt ?? r.gte!
      const strict = r.gt !== undefined
      lo = this.lowerBound(arr, x, strict)
    }
    let ro = arr.length
    if (r.lt !== undefined || r.lte !== undefined) {
      const x = r.lt ?? r.lte!
      const strict = r.lt !== undefined
      ro = this.upperBound(arr, x, strict)
    }
    if (lo < 0) lo = 0
    if (ro > arr.length) ro = arr.length
    if (lo > ro) return new Set()
    const out = new Set<number>()
    for (let i = lo; i < ro; i++) out.add(arr[i].id)
    return out
  }

  // internals
  private skey(v: Scalar): string { return typeof v + ':' + String(v) }
  private addEq(key: string, v: Scalar, id: number) {
    let m = this.eqMap.get(key); if (!m) this.eqMap.set(key, m = new Map())
    let s = m.get(this.skey(v)); if (!s) m.set(this.skey(v), s = new Set())
    s.add(id >>> 0)
  }
  private delEq(key: string, v: Scalar, id: number) {
    const m = this.eqMap.get(key); if (!m) return
    const s = m.get(this.skey(v)); if (!s) return
    s.delete(id >>> 0)
    if (s.size === 0) m.delete(this.skey(v))
  }
  private addExists(key: string, id: number) {
    let s = this.existsMap.get(key); if (!s) this.existsMap.set(key, s = new Set())
    s.add(id >>> 0)
  }
  private delExists(key: string, id: number) {
    const s = this.existsMap.get(key); if (!s) return
    s.delete(id >>> 0)
    if (s.size === 0) this.existsMap.delete(key)
  }
  private addNum(key: string, v: number, id: number) {
    let e = this.numMap.get(key); if (!e) this.numMap.set(key, e = { arr: [], dirty: false })
    e.arr.push({ v, id: id >>> 0 }); e.dirty = true
  }
  private delNum(key: string, v: number, id: number) {
    const e = this.numMap.get(key); if (!e) return
    const uid = id >>> 0
    e.arr = e.arr.filter(x => !(x.id === uid && x.v === v))
  }
  private addOrRemoveValue(mode: 'add' | 'del', key: string, val: AttrValue, uid: number) {
    const add = mode === 'add'
    const addEqFn = add ? this.addEq.bind(this) : this.delEq.bind(this)
    const addExistsFn = add ? this.addExists.bind(this) : this.delExists.bind(this)
    const addNumFn = add ? this.addNum.bind(this) : this.delNum.bind(this)
    if (val === null || val === undefined) { addExistsFn(key, uid); return }
    addExistsFn(key, uid)
    if (Array.isArray(val)) {
      for (const x of val) {
        if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') addEqFn(key, x, uid)
      }
      return
    }
    if (typeof val === 'string' || typeof val === 'boolean') { addEqFn(key, val, uid); return }
    if (typeof val === 'number') { addEqFn(key, val, uid); addNumFn(key, val, uid); return }
  }
  private ensureSorted(e: { arr: NumEntry[]; dirty: boolean }) {
    if (!e.dirty) return
    e.arr.sort((a, b) => a.v - b.v || a.id - b.id)
    e.dirty = false
  }
  private lowerBound(arr: NumEntry[], x: number, strict: boolean): number {
    let l = 0, r = arr.length
    while (l < r) {
      const m = (l + r) >> 1
      if (arr[m].v > x || (!strict && arr[m].v === x)) r = m
      else l = m + 1
    }
    if (strict) { let i = l; while (i < arr.length && arr[i].v <= x) i++; return i }
    return l
  }
  private upperBound(arr: NumEntry[], x: number, strict: boolean): number {
    let l = 0, r = arr.length
    while (l < r) {
      const m = (l + r) >> 1
      if (arr[m].v < x || (!strict && arr[m].v === x)) l = m + 1
      else r = m
    }
    if (strict) { let i = l; while (i > 0 && arr[i - 1].v >= x) i--; return i }
    return l
  }
}

export function createAttrIndex(strategy: 'basic' = 'basic'): AttrIndex {
  switch (strategy) {
    case 'basic':
    default:
      return new BasicAttrIndex()
  }
}

// Backwards-compatible helpers (thin wrappers)
export function setAttrs(idx: AttrIndex, id: number, attrs: Attrs | null): void { idx.setAttrs(id, attrs) }
export function getAttrs(idx: AttrIndex, id: number): Attrs | null { return idx.getAttrs(id) }
export function removeId(idx: AttrIndex, id: number): void { idx.removeId(id) }
export function queryEq(idx: AttrIndex, key: string, value: Scalar): Set<number> | null { return idx.eq(key, value) }
export function queryExists(idx: AttrIndex, key: string): Set<number> | null { return idx.exists(key) }
export function queryRange(idx: AttrIndex, key: string, r: Range): Set<number> | null { return idx.range(key, r) }
