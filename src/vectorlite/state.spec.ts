/**
 * state.ts spec
 *
 * Why: Sanity check that created instances expose expected state shape.
 */
import { describe, it, expect } from 'vitest'
import { createVectorLiteState } from './create'

describe('vectorlite/state', () => {
  it('exposes expected keys', () => {
    const vl = createVectorLiteState({ dim: 3, strategy: 'bruteforce' })
    expect(typeof vl.dim).toBe('number')
    expect(typeof vl.metric).toBe('string')
    expect(vl.store).toBeTruthy()
    expect(['bruteforce','hnsw','ivf']).toContain(vl.strategy)
    expect(vl.ann).toBeTruthy()
  })
})
