/**
 * HNSW tuning spec
 */
import { describe, it, expect } from 'vitest'
import { createVectorLite } from '../vectorlite/create'
import { add } from '../vectorlite/ops'
import { buildHNSWFromStore, tuneHnsw } from '../vectorlite/ops'

describe('tuneHnsw', () => {
  it('produces results and recall within [0,1]', () => {
    const dim = 4
    const bf = createVectorLite({ dim, metric: 'cosine', strategy: 'bruteforce' })
    const base1 = new Float32Array([1,0,0,0])
    const base2 = new Float32Array([0,1,0,0])
    function jit(b: Float32Array) { const v = new Float32Array(dim); for (let i=0;i<dim;i++) v[i]=b[i]+(Math.random()*2-1)*0.05; return v }
    let id=1
    for (let i=0;i<60;i++) add(bf, id++, jit(base1), null)
    for (let i=0;i<60;i++) add(bf, id++, jit(base2), null)
    const h = buildHNSWFromStore(bf, { M: 8, efSearch: 32 })
    const qs = [ jit(base1), jit(base2) ]
    const res = tuneHnsw(h, { efSearch: [16,32], M: [8] }, qs, 10)
    expect(res.length).toBeGreaterThan(0)
    for (const r of res) {
      expect(r.recall).toBeGreaterThanOrEqual(0)
      expect(r.recall).toBeLessThanOrEqual(1)
    }
  })
})

