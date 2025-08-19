/**
 * @file Bitmap-like Attribute Index Strategy (function-based).
 * - Equality and existence maps using nested Maps -> Set<id>.
 * - Numeric range is not supported (returns null).
 * - Implemented as pure functions over a container injected by the factory.
 */
import type { AttrIndex, Attrs } from "../index";
export type AttrValue = string | number | boolean | (string | number)[] | null;
import type { Range, Scalar } from "../filter/expr";

export type BitmapAttrContainer = {
  data: Map<number, Attrs>;
  eqMap: Map<string, Map<string, Set<number>>>;
  existsMap: Map<string, Set<number>>;
};

/**
 *
 */
export function createBitmapContainer(): BitmapAttrContainer {
  return {
    data: new Map<number, Attrs>(),
    eqMap: new Map<string, Map<string, Set<number>>>(),
    existsMap: new Map<string, Set<number>>(),
  };
}

const skey = (v: Scalar) => typeof v + ":" + String(v);

function addEq(c: BitmapAttrContainer, key: string, v: Scalar, id: number) {
  let m = c.eqMap.get(key);
  if (!m) c.eqMap.set(key, (m = new Map()));
  let s = m.get(skey(v));
  if (!s) m.set(skey(v), (s = new Set()));
  s.add(id >>> 0);
}
function delEq(c: BitmapAttrContainer, key: string, v: Scalar, id: number) {
  const m = c.eqMap.get(key);
  if (!m) return;
  const s = m.get(skey(v));
  if (!s) return;
  s.delete(id >>> 0);
  if (s.size === 0) m.delete(skey(v));
}
function addExists(c: BitmapAttrContainer, key: string, id: number) {
  let s = c.existsMap.get(key);
  if (!s) c.existsMap.set(key, (s = new Set()));
  s.add(id >>> 0);
}
function delExists(c: BitmapAttrContainer, key: string, id: number) {
  const s = c.existsMap.get(key);
  if (!s) return;
  s.delete(id >>> 0);
  if (s.size === 0) c.existsMap.delete(key);
}

function addOrRemoveValue(c: BitmapAttrContainer, mode: "add" | "del", key: string, val: AttrValue, uid: number) {
  const add = mode === "add";
  const doEq = add ? addEq : delEq;
  const doExists = add ? addExists : delExists;
  if (val === null || val === undefined) {
    doExists(c, key, uid);
    return;
  }
  doExists(c, key, uid);
  if (Array.isArray(val)) {
    for (const x of val)
      if (typeof x === "string" || typeof x === "number" || typeof x === "boolean") doEq(c, key, x, uid);
    return;
  }
  if (typeof val === "string" || typeof val === "boolean") {
    doEq(c, key, val, uid);
    return;
  }
  if (typeof val === "number") {
    doEq(c, key, val, uid);
    return;
  }
}

/**
 *
 */
export function bitmap_setAttrs(c: BitmapAttrContainer, id: number, attrs: Attrs | null): void {
  const uid = id >>> 0;
  bitmap_removeId(c, uid);
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) addOrRemoveValue(c, "add", k, v as AttrValue, uid);
  c.data.set(uid, attrs);
}
/**
 *
 */
export function bitmap_getAttrs(c: BitmapAttrContainer, id: number): Attrs | null {
  return c.data.get(id >>> 0) ?? null;
}
/**
 *
 */
export function bitmap_removeId(c: BitmapAttrContainer, id: number): void {
  const uid = id >>> 0;
  const old = c.data.get(uid);
  if (!old) return;
  for (const [k, val] of Object.entries(old)) {
    if (val === null || val === undefined) {
      delExists(c, k, uid);
      continue;
    }
    addOrRemoveValue(c, "del", k, val as AttrValue, uid);
  }
  c.data.delete(uid);
}
/**
 *
 */
export function bitmap_eq(c: BitmapAttrContainer, key: string, value: Scalar): Set<number> | null {
  const m = c.eqMap.get(key);
  if (!m) return null;
  const s = m.get(skey(value));
  return s ? new Set(s) : null;
}
/**
 *
 */
export function bitmap_exists(c: BitmapAttrContainer, key: string): Set<number> | null {
  const s = c.existsMap.get(key);
  return s ? new Set(s) : null;
}
/**
 *
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function bitmap_range(_c: BitmapAttrContainer, _key: string, _r: Range): Set<number> | null {
  // TODO: Implement bitmap range queries
  return null;
}

/**
 *
 */
export function createBitmapIndex(): AttrIndex {
  const c = createBitmapContainer();
  return {
    strategy: "bitmap",
    setAttrs: (id, attrs) => bitmap_setAttrs(c, id, attrs),
    getAttrs: (id) => bitmap_getAttrs(c, id),
    removeId: (id) => bitmap_removeId(c, id),
    eq: (key, value) => bitmap_eq(c, key, value),
    exists: (key) => bitmap_exists(c, key),
    range: (key, r) => bitmap_range(c, key, r),
  };
}
