/**
 * @file Quick local test for HNSW behavior.
 */

import { createVectorLite, add, search, serialize, deserializeVectorLite } from '../src/index.ts'

function assert(cond: any, msg: string) { if (!cond) throw new Error(msg) }

const dim = 4
const db = createVectorLite<{ tag: string }>({ dim, strategy: 'hnsw', hnsw: { M: 8, efConstruction: 32, efSearch: 16, seed: 123 } })
add(db, 1, new Float32Array([1, 0, 0, 0]), { tag: 'A' })
add(db, 2, new Float32Array([0.9, 0, 0, 0]), { tag: 'B' })
add(db, 3, new Float32Array([0, 1, 0, 0]), { tag: 'C' })
add(db, 4, new Float32Array([0, 0.9, 0, 0]), { tag: 'D' })

const q = new Float32Array([0.95, 0, 0, 0])
const hits = search(db, q, { k: 2 })
assert(hits.length === 2, 'expected 2 hits')
console.log('HNSW search hits', hits)

const buf = serialize(db)
const db2 = deserializeVectorLite<{ tag: string }>(buf)
const hits2 = search(db2, q, { k: 2 })
assert(hits2.length === 2, 'expected 2 hits after restore')
console.log('HNSW search hits after restore', hits2)

console.log('VectorLite HNSW save & search: PASS')
/**
 * @file Quick local test for HNSW behavior.
 */
