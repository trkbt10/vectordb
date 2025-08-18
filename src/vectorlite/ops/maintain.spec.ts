/** Maintain ops smoke test */
import { describe, it, expect } from 'vitest'
import { createVectorLite } from '../create'
import { add, remove } from './core'
import { hnswCompactAndRebuild } from './maintain'

describe('ops.maintain', () => {
  it('hnswCompactAndRebuild compacts when tombstones exist', () => {
    const vl = createVectorLite({ dim: 2, metric: 'cosine', strategy: 'hnsw', hnsw: { M: 4, efConstruction: 32 } })
    add(vl, 1, new Float32Array([1,0]), null)
    add(vl, 2, new Float32Array([0,1]), null)
    remove(vl, 1)
    const removed = hnswCompactAndRebuild(vl)
    expect(removed).toBeGreaterThan(0)
  })
})
