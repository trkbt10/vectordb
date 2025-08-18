/**
 * Filter-expression engine (subset, unnamed here).
 *
 * Why: Express attribute/meta constraints declaratively and compile them to a
 * predicate that can be used uniformly across strategies. When an attribute
 * index is present, we can also preselect candidate ids to reduce scoring work.
 */

export type Scalar = string | number | boolean
export type ScalarOrArray = Scalar | Scalar[]

export type Range = {
  gt?: number
  gte?: number
  lt?: number
  lte?: number
}

export type HasId = { values: number[] }

export type LeafExpr = {
  key?: string
  scope?: 'attrs' | 'meta' // default: 'attrs'
  match?: ScalarOrArray
  range?: Range
  exists?: boolean
  is_null?: boolean
}

export type BoolExpr = {
  must?: FilterExpr[]
  must_not?: FilterExpr[]
  should?: FilterExpr[]
  should_min?: number
}

export type HasIdOnly = { has_id: HasId }
export type FilterExpr = LeafExpr | BoolExpr | HasIdOnly | (HasIdOnly & BoolExpr)

export type MetaLike = any
export type AttrsLike = Record<string, any> | null | undefined

export type CompiledPredicate = (id: number, meta: MetaLike, attrs?: AttrsLike) => boolean

function isObject(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === 'object' }

function getByPath(obj: any, path: string | undefined): any {
  if (!path) return undefined
  if (obj == null) return undefined
  const parts = path.split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p as keyof typeof cur]
  }
  return cur
}

function ensureArray<T>(v: T | T[]): T[] { return Array.isArray(v) ? v : [v] }

function compileLeaf(l: LeafExpr): (id: number, meta: MetaLike, attrs?: AttrsLike) => boolean {
  const scope = l.scope ?? 'attrs'
  const getter = (id: number, meta: MetaLike, attrs?: AttrsLike) => {
    if (l.key === undefined) return undefined
    const src = scope === 'attrs' ? attrs : meta
    return getByPath(src, l.key)
  }
  if (l.match !== undefined) {
    const arr = ensureArray(l.match)
    return (_id, meta, attrs) => {
      const v = getter(_id, meta, attrs)
      if (Array.isArray(v)) {
        // any overlap of scalar list with array value
        for (const x of arr) {
          if (v.includes(x)) return true
        }
        return false
      }
      return arr.some(x => x === v)
    }
  }
  if (l.exists !== undefined) {
    const want = !!l.exists
    return (_id, meta, attrs) => {
      const v = getter(_id, meta, attrs)
      const ex = v !== undefined && v !== null
      return want ? ex : !ex
    }
  }
  if (l.is_null !== undefined) {
    const want = !!l.is_null
    return (_id, meta, attrs) => {
      const v = getter(_id, meta, attrs)
      const isNull = v === null
      return want ? isNull : !isNull
    }
  }
  if (l.range) {
    const r = l.range
    return (_id, meta, attrs) => {
      const v = getter(_id, meta, attrs)
      if (typeof v !== 'number') return false
      if (r.gt !== undefined && !(v > r.gt)) return false
      if (r.gte !== undefined && !(v >= r.gte)) return false
      if (r.lt !== undefined && !(v < r.lt)) return false
      if (r.lte !== undefined && !(v <= r.lte)) return false
      return true
    }
  }
  // no-op leaf => always true
  return () => true
}

/** Compile a filter expression into a predicate: (id, meta, attrs?) => boolean. */
export function compilePredicate(expr: FilterExpr): CompiledPredicate {
  if ('has_id' in expr) {
    const set = new Set(expr.has_id.values.map(v => v >>> 0))
    const { has_id, ...rest } = expr as HasIdOnly & Partial<BoolExpr>
    const hasRest = Object.keys(rest).length > 0
    if (!hasRest) {
      return (id) => set.has(id >>> 0)
    }
    const restPred = compilePredicate(rest as FilterExpr)
    return (id, meta, attrs) => set.has(id >>> 0) && restPred(id, meta, attrs)
  }
  const l = expr as Partial<LeafExpr>
  if (l && (l.match !== undefined || l.range !== undefined || l.exists !== undefined || l.is_null !== undefined)) {
    return compileLeaf(l as LeafExpr)
  }
  const b = expr as BoolExpr
  const must = (b.must ?? []).map(compilePredicate)
  const must_not = (b.must_not ?? []).map(compilePredicate)
  const should = (b.should ?? []).map(compilePredicate)
  const should_min = Math.max(0, b.should_min ?? (should.length > 0 ? 1 : 0))
  return (id, meta, attrs) => {
    for (const m of must) { if (!m(id, meta, attrs)) return false }
    for (const n of must_not) { if (n(id, meta, attrs)) return false }
    if (should.length > 0) {
      let ok = 0
      for (const s of should) { if (s(id, meta, attrs)) ok++ }
      if (ok < should_min) return false
    }
    return true
  }
}

// Types and helpers for preselection (paired with attribute index)
export type CandidateSet = Set<number>

export type AttrIndexReader = {
  // return a set of ids whose key equals given scalar value
  eq(key: string, value: Scalar): CandidateSet | null
  // return a set of ids with key present and not null
  exists(key: string): CandidateSet | null
  // return ids whose numeric key in range; unsupported -> null
  range(key: string, r: Range): CandidateSet | null
}

function unionInto(dst: CandidateSet | null, src: CandidateSet | null): CandidateSet | null {
  if (!src) return dst
  if (!dst) return new Set(src)
  for (const v of src) dst.add(v)
  return dst
}

function intersectInto(dst: CandidateSet | null, src: CandidateSet | null): CandidateSet | null {
  if (!dst && !src) return null
  if (!dst) return src ? new Set(src) : null
  if (!src) return dst ? new Set(dst) : null
  const out = new Set<number>()
  const small = dst.size <= src.size ? dst : src
  const large = dst.size <= src.size ? src : dst
  for (const v of small) if (large.has(v)) out.add(v)
  return out
}

function subtractInto(dst: CandidateSet | null, src: CandidateSet | null): CandidateSet | null {
  if (!dst) return null
  if (!src) return new Set(dst)
  const out = new Set(dst)
  for (const v of src) out.delete(v)
  return out
}

/**
 * Preselect candidate ids using an AttrIndexReader. Returns null if reader is
 * missing or expression cannot be mapped to index lookups.
 */
export function preselectCandidates(expr: FilterExpr, idx: AttrIndexReader | null): CandidateSet | null {
  // if no index supplied, bail
  if (!idx) return null
  if ('has_id' in expr) return new Set(expr.has_id.values.map(v => v >>> 0))
  // leaf
  const l = expr as LeafExpr
  const isLeaf = l.match !== undefined || l.range !== undefined || l.exists !== undefined || l.is_null !== undefined
  if (isLeaf) {
    const scope = l.scope ?? 'attrs'
    if (scope !== 'attrs') return null // index only covers attrs
    if (l.match !== undefined && l.key) {
      const vals = ensureArray(l.match).filter(v => typeof v !== 'object') as Scalar[]
      let out: CandidateSet | null = null
      for (const v of vals) out = unionInto(out, idx.eq(l.key!, v))
      return out
    }
    if (l.exists !== undefined && l.key) {
      return l.exists ? idx.exists(l.key) : null
    }
    if (l.range && l.key) {
      return idx.range(l.key, l.range)
    }
    return null
  }
  // bool
  const b = expr as BoolExpr
  let cur: CandidateSet | null = null
  // must: intersect
  if (b.must && b.must.length) {
    for (const e of b.must) {
      const s = preselectCandidates(e, idx)
      cur = intersectInto(cur, s)
    }
  }
  // should: union
  if (b.should && b.should.length) {
    let u: CandidateSet | null = null
    for (const e of b.should) u = unionInto(u, preselectCandidates(e, idx))
    cur = cur ? intersectInto(cur, u) : u
  }
  // must_not: subtract
  if (b.must_not && b.must_not.length) {
    for (const e of b.must_not) cur = subtractInto(cur, preselectCandidates(e, idx))
  }
  return cur
}
