/**
 * VectorLite Filtered Search Demo (console-based)
 * - Demonstrates attribute index + filter-expression based search
 * - Shows attribute-scoped and meta-scoped filtering
 */
import {
  createVectorLite,
  add,
  size,
  searchWithExpr,
  setMeta,
} from '../../../src/index'
import { createAttrIndex, setAttrs } from '../../../src/attr/index'

type Meta = { memo?: string; lang?: string }

const ts = () => new Date().toISOString().split('T')[1].replace('Z', '')
const log = (m: string) => console.log(`[${ts()}] ${m}`)

async function main() {
  console.log('VectorLite Filtered Search Demo — console mode')
  const db = createVectorLite<Meta>({ dim: 3, metric: 'cosine', strategy: 'bruteforce' })
  const idx = createAttrIndex('basic')

  // Add sample vectors + meta
  add(db, 1, new Float32Array([1, 0, 0]), { memo: 'alpha', lang: 'en' })
  add(db, 2, new Float32Array([0.95, 0, 0]), { memo: 'bravo', lang: 'ja' })
  add(db, 3, new Float32Array([0.5, 0.5, 0]), { memo: 'charlie', lang: 'en' })
  add(db, 4, new Float32Array([0, 1, 0]), { memo: 'delta', lang: 'fr' })

  // Attributes (indexable; separate from meta)
  setAttrs(idx, 1, { color: 'red',   price: 10, tags: ['a', 'x'] })
  setAttrs(idx, 2, { color: 'blue',  price: 20, tags: ['b'] })
  setAttrs(idx, 3, { color: 'red',   price: 15, tags: ['a', 'b'] })
  setAttrs(idx, 4, { color: 'green', price: 17, tags: ['c'] })
  log(`init size=${size(db)} (indexed attributes installed)\n`)

  // Query vector close to [1,0,0]
  const q = new Float32Array([1, 0, 0])

  // 1) Attribute filter: color=red AND 10 <= price < 20
  const expr1 = {
    must: [
      { key: 'color', match: 'red' },
      { key: 'price', range: { gte: 10, lt: 20 } },
    ],
  }
  const hits1 = searchWithExpr(db, q, expr1 as any, { k: 10, index: idx })
  log(`expr1 color='red' && 10<=price<20 -> [${hits1.map(h => `${h.id}:${(h.meta as Meta)?.memo ?? ''}`).join(', ')}]`)

  // 2) Attribute filter: tags contains 'a' (match on array)
  const expr2 = { key: 'tags', match: 'a' }
  const hits2 = searchWithExpr(db, q, expr2 as any, { k: 10, index: idx })
  log(`expr2 tags contains 'a' -> [${hits2.map(h => h.id).join(', ')}]`)

  // 3) Meta-scoped filter: lang == 'en' (scope: 'meta')
  const expr3 = { key: 'lang', match: 'en', scope: 'meta' }
  const hits3 = searchWithExpr(db, q, expr3 as any, { k: 10, index: idx })
  log(`expr3 meta.lang == 'en' -> [${hits3.map(h => h.id).join(', ')}]`)

  // 4) Combine has_id + must_not
  const expr4 = {
    has_id: { values: [1, 2, 3, 4] },
    must_not: [ { key: 'color', match: 'blue' } ],
  }
  const hits4 = searchWithExpr(db, q, expr4 as any, { k: 10, index: idx })
  log(`expr4 has_id∩!color=blue -> [${hits4.map(h => h.id).join(', ')}]`)

  // 5) Update meta and query meta scope again
  setMeta(db, 2, { memo: 'bravo', lang: 'en' })
  const hits5 = searchWithExpr(db, q, expr3 as any, { k: 10, index: idx })
  log(`expr5 after setMeta(2, lang='en') -> [${hits5.map(h => h.id).join(', ')}]`)

  console.log('\nDone.')
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
