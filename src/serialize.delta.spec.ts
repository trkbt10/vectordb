/**
 * Snapshot delta/checksum spec
 */
import { describe, it, expect } from 'vitest'
import { createVectorLiteState } from './vectorlite/create'
import { add, getOne } from './vectorlite/ops/core'
import { serializeFull, serializeDelta, mergeSnapshotWithDelta, deserializeVectorLite } from './vectorlite/serialize'
import { encodeWal } from './wal'

describe('serialize: full + delta + merge', () => {
  it('merges WAL delta over base snapshot', async () => {
    const vl = createVectorLiteState<{ lang?: string | null }>({ dim: 3, metric: 'cosine', strategy: 'bruteforce' })
    add(vl, 1, new Float32Array([1, 0, 0]), { lang: 'ja' })
    add(vl, 2, new Float32Array([0, 1, 0]), { lang: 'en' })
    const full = await serializeFull(vl)
    expect(full.data.byteLength).toBeGreaterThan(0)

    const wal = encodeWal([
      { type: 'upsert', id: 2, vector: new Float32Array([0, 0.9, 0.1]), meta: { lang: 'en' } },
      { type: 'upsert', id: 3, vector: new Float32Array([0, 0, 1]), meta: { lang: 'fr' } },
    ])
    const delta = await serializeDelta(vl, wal)
    expect(delta.data.byteLength).toBeGreaterThan(0)

    const merged = mergeSnapshotWithDelta(full.data, delta.data)
    const vl2 = deserializeVectorLite<{ lang?: string | null }>(merged)
    const r2 = getOne(vl2, 2)
    const r3 = getOne(vl2, 3)
    expect(r2 && r2.vector[1]).toBeGreaterThan(0.5)
    expect(r3 && r3.meta && r3.meta.lang).toBe('fr')
  })
})
