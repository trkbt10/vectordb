import { test, expect } from 'bun:test'
import { createVectorLite, get, search } from '../src/vectorlite'
import { encodeWal, applyWal } from '../src/wal'

test('WAL encode/apply upsert/remove works', () => {
  const db = createVectorLite<{ tag?: string }>({ dim: 2 })
  const recs = [
    { type: 'upsert', id: 42, vector: new Float32Array([1, 0]), meta: { tag: 'x' } },
    { type: 'setMeta', id: 42, meta: { tag: 'y' } },
  ] as const
  const wal = encodeWal(recs as any)
  applyWal(db, wal)
  const r1 = get(db, 42)
  expect(r1?.meta).toEqual({ tag: 'y' })
  // remove
  const wal2 = encodeWal([{ type: 'remove', id: 42 }])
  applyWal(db, wal2)
  expect(get(db, 42)).toBeNull()
  // sanity: add a neighbor and search
  applyWal(db, encodeWal([{ type: 'upsert', id: 1, vector: new Float32Array([1, 0]), meta: null }]))
  const hit = search(db, new Float32Array([1, 0]), { k: 1 })[0]
  expect(hit.id).toBe(1)
})

