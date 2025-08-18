/**
 * Stats/diagnose spec.
 *
 * Why: Validate fields are populated and suggestions can be produced.
 */
import { describe, it, expect } from 'vitest'
import { createVectorLite } from '../create'
import { add } from './core'
import { stats, diagnose } from './stats'

describe('ops.stats', () => {
  it('stats exposes basic fields', () => {
    const vl = createVectorLite({ dim: 2, metric: 'cosine', strategy: 'bruteforce' })
    add(vl, 1, new Float32Array([1,0]), null)
    const s = stats(vl)
    expect(s.n).toBe(1)
    expect(s.strategy).toBe('bruteforce')
  })
  it('diagnose returns structure', () => {
    const vl = createVectorLite({ dim: 2, metric: 'cosine', strategy: 'bruteforce' })
    add(vl, 1, new Float32Array([1,0]), null)
    const d = diagnose(vl)
    expect(Array.isArray(d.suggestions)).toBe(true)
  })
})
