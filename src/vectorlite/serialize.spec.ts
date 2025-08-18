/**
 * serialize.ts spec
 *
 * Why: Ensure roundtrip preserves data/strategy and supports all strategies.
 */
import { describe, it, expect } from 'vitest'
import { createVectorLite } from './create'
import { add } from './ops/core'
import { serialize, deserializeVectorLite } from './serialize'

describe('vectorlite/serialize', () => {
  it('roundtrips bruteforce', () => {
    const vl = createVectorLite<{ tag?: string }>({ dim: 3, strategy: 'bruteforce' })
    add(vl, 1, new Float32Array([1,0,0]), { tag: 'a' })
    const buf = serialize(vl)
    const vl2 = deserializeVectorLite<{ tag?: string }>(buf)
    expect(vl2.strategy).toBe('bruteforce')
    expect(vl2.store._count).toBe(1)
  })

  it('roundtrips HNSW', () => {
    const vl = createVectorLite({ dim: 2, strategy: 'hnsw', hnsw: { M: 6, efSearch: 16 } })
    add(vl, 1, new Float32Array([1,0]), null)
    const buf = serialize(vl)
    const vl2 = deserializeVectorLite(buf)
    expect(vl2.strategy).toBe('hnsw')
    expect(vl2.store._count).toBe(1)
  })

  it('roundtrips IVF', () => {
    const vl = createVectorLite({ dim: 2, strategy: 'ivf', ivf: { nlist: 4, nprobe: 2 } })
    add(vl, 1, new Float32Array([1,0]), null)
    const buf = serialize(vl)
    const vl2 = deserializeVectorLite(buf)
    expect(vl2.strategy).toBe('ivf')
    expect(vl2.store._count).toBe(1)
  })
})

