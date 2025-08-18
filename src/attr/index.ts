/**
 * @file Attribute Index (public interface and factory).
 *
 * Why: We want filterable, indexable attributes decoupled from meta, with
 * strategy-pluggable backends (e.g., basic vs bitmap) and a minimal, stable
 * IO surface. This file defines the shared types, simple helper wrappers, and
 * the factory that injects each strategy's container and pure functions.
 */
import type { Range, Scalar } from '../filter/expr'

export type AttrValue = string | number | boolean | (string | number)[] | null
export type Attrs = Record<string, AttrValue>

export type AttrIndex = {
  strategy: string
  setAttrs(id: number, attrs: Attrs | null): void
  getAttrs(id: number): Attrs | null
  removeId(id: number): void
  eq(key: string, value: Scalar): Set<number> | null
  exists(key: string): Set<number> | null
  range(key: string, r: Range): Set<number> | null
}

// ------------ Basic strategy: container + pure functions ------------
type NumEntry = { v: number; id: number }

export type BasicAttrContainer = {
  data: Map<number, Attrs>
  eqMap: Map<string, Map<string, Set<number>>>
  existsMap: Map<string, Set<number>>
  numMap: Map<string, { arr: NumEntry[]; dirty: boolean }>
}

/**
 *
 */
export function createBasicContainer(): BasicAttrContainer {
  return {
    data: new Map<number, Attrs>(),
    eqMap: new Map<string, Map<string, Set<number>>>(),
    existsMap: new Map<string, Set<number>>(),
    numMap: new Map<string, { arr: NumEntry[]; dirty: boolean }>(),
  }
}

const skey = (v: Scalar) => typeof v + ':' + String(v)
const ensureSorted = (e: { arr: NumEntry[]; dirty: boolean }) => { if (!e.dirty) return; e.arr.sort((a,b)=> a.v - b.v || a.id - b.id); e.dirty = false }

function lowerBound(arr: NumEntry[], x: number, strict: boolean): number {
  let l=0,r=arr.length; while(l<r){ const m=(l+r)>>1; if (arr[m].v > x || (!strict && arr[m].v===x)) r=m; else l=m+1 };
  if (strict) { let i=l; while (i<arr.length && arr[i].v<=x) i++; return i } return l
}
function upperBound(arr: NumEntry[], x: number, strict: boolean): number {
  let l=0,r=arr.length; while(l<r){ const m=(l+r)>>1; if (arr[m].v < x || (!strict && arr[m].v===x)) l=m+1; else r=m };
  if (strict) { let i=l; while (i>0 && arr[i-1].v>=x) i--; return i } return l
}

function addEq(c: BasicAttrContainer, key: string, v: Scalar, id: number) { let m = c.eqMap.get(key); if (!m) c.eqMap.set(key, m = new Map()); let s = m.get(skey(v)); if (!s) m.set(skey(v), s = new Set()); s.add(id>>>0) }
function delEq(c: BasicAttrContainer, key: string, v: Scalar, id: number) { const m = c.eqMap.get(key); if (!m) return; const s = m.get(skey(v)); if (!s) return; s.delete(id>>>0); if (s.size===0) m.delete(skey(v)) }
function addExists(c: BasicAttrContainer, key: string, id: number) { let s = c.existsMap.get(key); if (!s) c.existsMap.set(key, s = new Set()); s.add(id>>>0) }
function delExists(c: BasicAttrContainer, key: string, id: number) { const s = c.existsMap.get(key); if (!s) return; s.delete(id>>>0); if (s.size===0) c.existsMap.delete(key) }
function addNum(c: BasicAttrContainer, key: string, v: number, id: number) { let e = c.numMap.get(key); if (!e) c.numMap.set(key, e = { arr: [], dirty: false }); e.arr.push({ v, id: id>>>0 }); e.dirty = true }
function delNum(c: BasicAttrContainer, key: string, v: number, id: number) { const e = c.numMap.get(key); if (!e) return; const uid = id>>>0; e.arr = e.arr.filter(x => !(x.id===uid && x.v===v)) }

function addOrRemoveValue(c: BasicAttrContainer, mode: 'add' | 'del', key: string, val: AttrValue, uid: number) {
  const add = mode === 'add'
  const doEq = add ? addEq : delEq
  const doExists = add ? addExists : delExists
  const doNum = add ? addNum : delNum
  if (val === null || val === undefined) { doExists(c, key, uid); return }
  doExists(c, key, uid)
  if (Array.isArray(val)) { for (const x of val) if (typeof x==='string'||typeof x==='number'||typeof x==='boolean') doEq(c, key, x, uid); return }
  if (typeof val === 'string' || typeof val === 'boolean') { doEq(c, key, val, uid); return }
  if (typeof val === 'number') { doEq(c, key, val, uid); doNum(c, key, val, uid); return }
}

/**
 *
 */
export function basic_setAttrs(c: BasicAttrContainer, id: number, attrs: Attrs | null): void {
  const uid = id>>>0
  basic_removeId(c, uid)
  if (!attrs) return
  for (const [k,v] of Object.entries(attrs)) addOrRemoveValue(c, 'add', k, v as AttrValue, uid)
  c.data.set(uid, attrs)
}

/**
 *
 */
export function basic_getAttrs(c: BasicAttrContainer, id: number): Attrs | null { return c.data.get(id>>>0) ?? null }

/**
 *
 */
export function basic_removeId(c: BasicAttrContainer, id: number): void {
  const uid = id>>>0
  const old = c.data.get(uid); if (!old) return
  for (const [k,val] of Object.entries(old)) {
    if (val === null || val === undefined) { delExists(c, k, uid); continue }
    addOrRemoveValue(c, 'del', k, val as AttrValue, uid)
  }
  c.data.delete(uid)
}

/**
 *
 */
export function basic_eq(c: BasicAttrContainer, key: string, value: Scalar): Set<number> | null { const m = c.eqMap.get(key); if (!m) return null; const s = m.get(typeof value+':'+String(value)); return s ? new Set(s) : null }
/**
 *
 */
export function basic_exists(c: BasicAttrContainer, key: string): Set<number> | null { const s = c.existsMap.get(key); return s ? new Set(s) : null }
/**
 *
 */
export function basic_range(c: BasicAttrContainer, key: string, r: Range): Set<number> | null {
  const e = c.numMap.get(key); if (!e) return null; ensureSorted(e); const arr = e.arr; if (arr.length===0) return new Set()
  let lo = 0; if (r.gt!==undefined || r.gte!==undefined) { const x = r.gt ?? r.gte!; const strict = r.gt!==undefined; lo = lowerBound(arr, x, strict) }
  let ro = arr.length; if (r.lt!==undefined || r.lte!==undefined) { const x = r.lt ?? r.lte!; const strict = r.lt!==undefined; ro = upperBound(arr, x, strict) }
  if (lo<0) lo=0; if (ro>arr.length) ro=arr.length; if (lo>ro) return new Set(); const out = new Set<number>(); for (let i=lo;i<ro;i++) out.add(arr[i].id); return out
}

function createBasic(): AttrIndex {
  const c = createBasicContainer()
  return {
    strategy: 'basic',
    setAttrs: (id, attrs) => basic_setAttrs(c, id, attrs),
    getAttrs: (id) => basic_getAttrs(c, id),
    removeId: (id) => basic_removeId(c, id),
    eq: (key, value) => basic_eq(c, key, value),
    exists: (key) => basic_exists(c, key),
    range: (key, r) => basic_range(c, key, r),
  }
}

import { createBasicIndex } from './strategies/basic'
import { createBitmapIndex } from './strategies/bitmap'

/**
 * Create an attribute index instance with a given strategy.
 * Why: Allow future evolution (performance/features) behind a stable interface.
 */
export function createAttrIndex(strategy: 'basic' | 'bitmap' = 'basic'): AttrIndex {
  switch (strategy) {
    case 'bitmap':
      return createBitmapIndex()
    case 'basic':
    default:
      if (strategy === 'basic') return createBasicIndex()
      throw new Error(`Unsupported attribute index strategy: ${String(strategy)}. Use 'basic' | 'bitmap'.`)
  }
}

// Backwards-compatible helpers (thin wrappers)
/** Set all attributes for an id (replaces previous). */
export function setAttrs(idx: AttrIndex, id: number, attrs: Attrs | null): void { idx.setAttrs(id, attrs) }
/** Get attributes for an id (or null). */
export function getAttrs(idx: AttrIndex, id: number): Attrs | null { return idx.getAttrs(id) }
/** Remove all attributes for an id. */
export function removeId(idx: AttrIndex, id: number): void { idx.removeId(id) }
/** Equality preselection for a key/value. */
export function queryEq(idx: AttrIndex, key: string, value: Scalar): Set<number> | null { return idx.eq(key, value) }
/** Existence preselection for a key. */
export function queryExists(idx: AttrIndex, key: string): Set<number> | null { return idx.exists(key) }
/** Numeric range preselection for a key. */
export function queryRange(idx: AttrIndex, key: string, r: Range): Set<number> | null { return idx.range(key, r) }

// Concrete strategy implementations have moved to ./strategies/*
/**
 * @file Attribute subsystem public API.
 */
