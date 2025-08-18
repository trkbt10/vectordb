/**
 * IVF retrain wrappers spec.
 *
 * Why: Ensure wrapper functions call into IVF module and produce reasonable outputs.
 */
import { describe, it, expect } from 'vitest'
import { createVectorLite } from '../create'
import { add } from './core'
import { trainIvfCentroids, reassignIvfLists, evaluateIvf } from './ivf'

describe('ops.ivf_retrain', () => {
  it('trains, reassigns and evaluates', () => {
    const vl = createVectorLite({ dim: 3, metric: 'cosine', strategy: 'ivf', ivf: { nlist: 4, nprobe: 2 } })
    for (let i=0;i<40;i++) add(vl, i+1, new Float32Array([1,0,0]), null)
    for (let i=0;i<40;i++) add(vl, 100+i, new Float32Array([0,1,0]), null)
    const t = trainIvfCentroids(vl, { iters: 4, seed: 7 })
    expect(t.updated).toBeGreaterThan(0)
    const r = reassignIvfLists(vl)
    expect(r.moved).toBeGreaterThan(0)
    const ev = evaluateIvf(vl, [new Float32Array([1,0,0]), new Float32Array([0,1,0])], 5)
    expect(ev.recall).toBeGreaterThanOrEqual(0)
    expect(ev.recall).toBeLessThanOrEqual(1)
  })
})
