/**
 * create.ts spec
 *
 * Why: Verify that instances are constructed correctly across strategies/metrics
 * and expose the expected state shape.
 */
import { describe, it, expect } from 'vitest'
import { createVectorLite } from './create'

describe('vectorlite/create', () => {
  it('creates bruteforce by default with cosine metric', () => {
    const vl = createVectorLite({ dim: 3 })
    expect(vl.dim).toBe(3)
    expect(vl.metric).toBe('cosine')
    expect(vl.strategy).toBe('bruteforce')
    expect(vl.store._capacity).toBeGreaterThan(0)
  })

  it('creates HNSW with provided params', () => {
    const vl = createVectorLite({ dim: 4, strategy: 'hnsw', hnsw: { M: 8, efSearch: 32 } })
    expect(vl.strategy).toBe('hnsw')
    expect(vl.dim).toBe(4)
  })

  it('creates IVF with nlist/nprobe', () => {
    const vl = createVectorLite({ dim: 2, strategy: 'ivf', ivf: { nlist: 8, nprobe: 2 } })
    expect(vl.strategy).toBe('ivf')
    expect(vl.dim).toBe(2)
  })
})

