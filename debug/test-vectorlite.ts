import { createVectorLite } from '../src/vectorlite.ts'
import { serialize, deserializeVectorLite, add, search } from '../src/vectorlite.ts'

function approxEqual(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps
}

function assert(condition: any, msg: string) {
  if (!condition) throw new Error('Assertion failed: ' + msg)
}

async function main() {
  // Cosine metric: add three vectors and query
  const cos = createVectorLite<{ tag: string }>({ dim: 3, metric: 'cosine' })
  add(cos, 1, new Float32Array([1, 0, 0]), { tag: 'A' })
  add(cos, 2, new Float32Array([0.9, 0, 0]), { tag: 'B' })
  add(cos, 3, new Float32Array([0, 1, 0]), { tag: 'C' })

  const q1 = new Float32Array([1, 0, 0])
  const hits1 = search(cos, q1, { k: 2 })
  assert(hits1.length === 2, 'cosine: expected 2 hits')
  const ids1 = hits1.map(h => h.id).sort((a, b) => a - b)
  assert(ids1[0] === 1 && ids1[1] === 2, 'cosine: top2 should be {1,2}')
  assert(approxEqual(hits1[0].score, 1) || approxEqual(hits1[1].score, 1), 'cosine: score should be ~1')

  // Serialize and deserialize, then search again
  const buf = serialize(cos)
  const cos2 = deserializeVectorLite<{ tag: string }>(buf)
  const hits2 = search(cos2, q1, { k: 2 })
  const ids2 = hits2.map(h => h.id).sort((a, b) => a - b)
  assert(ids2[0] === 1 && ids2[1] === 2, 'cosine (restored): top2 should be {1,2}')

  // L2 metric: distinct distances
  const l2 = createVectorLite({ dim: 3, metric: 'l2' })
  add(l2, 10, new Float32Array([1, 0, 0]))
  add(l2, 20, new Float32Array([0.9, 0, 0]))
  add(l2, 30, new Float32Array([0, 1, 0]))

  const q2 = new Float32Array([0.99, 0, 0])
  const hits3 = search(l2, q2, { k: 2 })
  assert(hits3.length === 2, 'l2: expected 2 hits')
  // For l2 we store negative distances: closer => higher score
  assert(hits3[0].id === 10, 'l2: nearest should be id=10')

  console.log('VectorLite save & search: PASS')
}

main().catch((e) => {
  console.error('VectorLite save & search: FAIL')
  console.error(e)
  process.exit(1)
})
