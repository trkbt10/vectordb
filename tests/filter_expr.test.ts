import { test, expect } from 'bun:test'
import { createVectorLite, add, searchWithExpr } from '../src/vectorlite'
import { createAttrIndex, setAttrs, removeId } from '../src/attr/index'

test('filter expr: equality and range with index, bruteforce', () => {
  const db = createVectorLite<{ memo?: string }>({ dim: 3, metric: 'cosine', strategy: 'bruteforce' })
  // unit vectors on x-axis scaled
  add(db, 1, new Float32Array([1, 0, 0]), { memo: 'a' })
  add(db, 2, new Float32Array([0.99, 0, 0]), { memo: 'b' })
  add(db, 3, new Float32Array([0.5, 0, 0]), { memo: 'c' })

  const idx = createAttrIndex()
  setAttrs(idx, 1, { color: 'red', price: 10 })
  setAttrs(idx, 2, { color: 'blue', price: 20 })
  setAttrs(idx, 3, { color: 'red', price: 15 })

  // must: color=red, range: 10 <= price < 20
  const expr = {
    must: [
      { key: 'color', match: 'red' },
      { key: 'price', range: { gte: 10, lt: 20 } },
    ],
  }
  const hits = searchWithExpr(db, new Float32Array([1, 0, 0]), expr as any, { k: 3, index: idx })
  const ids = hits.map(h => h.id).sort((a,b)=>a-b)
  expect(ids).toEqual([1,3])
})

test('filter expr: has_id and must_not/should', () => {
  const db = createVectorLite<{ memo?: string }>({ dim: 2 })
  add(db, 10, new Float32Array([1, 0]), null)
  add(db, 11, new Float32Array([0.9, 0]), null)
  add(db, 12, new Float32Array([0.8, 0]), null)

  const idx = createAttrIndex()
  setAttrs(idx, 10, { tag: ['a','b'] })
  setAttrs(idx, 11, { tag: ['b'] })
  setAttrs(idx, 12, { tag: ['c'] })

  const expr = {
    has_id: { values: [10, 11, 12] },
    must_not: [ { key: 'tag', match: 'c' } ],
    should: [ { key: 'tag', match: 'a' } ],
    should_min: 0,
  }
  const hits = searchWithExpr(db, new Float32Array([1, 0]), expr as any, { k: 5, index: idx })
  const ids = hits.map(h => h.id).sort((a,b)=>a-b)
  expect(ids).toEqual([10,11])
})

test('attr index removal stays consistent', () => {
  const db = createVectorLite({ dim: 2 })
  add(db, 1, new Float32Array([1,0]))
  add(db, 2, new Float32Array([0.9,0]))
  const idx = createAttrIndex()
  setAttrs(idx, 1, { group: 'g1' })
  setAttrs(idx, 2, { group: 'g2' })
  removeId(idx, 2)
  const expr = { key: 'group', match: 'g2' }
  const hits = searchWithExpr(db, new Float32Array([1,0]), expr as any, { k: 5, index: idx })
  expect(hits.length).toBe(0)
})
