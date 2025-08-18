import { test, expect } from 'bun:test'
import { createVectorLite, getMeta } from '../src/vectorlite'
import { encodeWal, applyWal } from '../src/wal'

test('decodeWal handles concatenated WAL segments', () => {
  const wal1 = encodeWal([{ type: 'upsert', id: 1, vector: new Float32Array([1, 0, 0]), meta: { tag: 'alpha' } }])
  const wal2 = encodeWal([
    { type: 'upsert', id: 2, vector: new Float32Array([0.9, 0, 0]), meta: { tag: 'beta' } },
    { type: 'setMeta', id: 1, meta: { tag: 'alpha2' } },
  ])
  const wal3 = encodeWal([{ type: 'remove', id: 2 }])
  const merged = new Uint8Array(wal1.length + wal2.length + wal3.length)
  merged.set(wal1, 0)
  merged.set(wal2, wal1.length)
  merged.set(wal3, wal1.length + wal2.length)

  const db = createVectorLite<{ tag?: string }>({ dim: 3, metric: 'cosine' })
  applyWal(db, merged)

  expect(getMeta(db, 1)).toEqual({ tag: 'alpha2' })
  expect(getMeta(db, 2)).toBeNull()
})
