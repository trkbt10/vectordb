/**
 * @file Tests for data segmenter (writeSegments)
 */
import { describe, it, expect } from 'bun:test'
import { writeSegments } from './segmenter'
import { createVectorLiteState } from '../vectorlite/create'
import type { CrushMap } from './types'
import { createMemoryFileIO } from '../persist/memory'

describe('indexing/segmenter', () => {
  it('writes segments and returns pointers/manifest', async () => {
    const vl = createVectorLiteState<{ tag?: string }>({ dim: 2, metric: 'cosine', strategy: 'bruteforce' })
    for (let i=0;i<5;i++){ vl.store.ids[i]=i+1; vl.store.data.set(new Float32Array([i,i+1]), i*2); vl.store.metas[i]=null; vl.store.pos.set(i+1,i); vl.store._count=i+1 }
    const crush: CrushMap = { pgs: 8, replicas: 1, targets: [{key:'X'},{key:'Y'}] }
    const stores: Record<string, ReturnType<typeof createMemoryFileIO>> = { X: createMemoryFileIO(), Y: createMemoryFileIO() }
    const res = await writeSegments(vl, { baseName: 'db', crush, resolveDataIO: (k)=>stores[k], segmented: true, segmentBytes: 1<<14 })
    expect(res.entries.length).toBe(5)
    // Ensure data written to either X or Y via .data files
    const wroteX = await (async ()=>{ try{ await stores.X.read('db.pg0.part0.data'); return true }catch{ return false } })()
    const wroteY = await (async ()=>{ try{ await stores.Y.read('db.pg0.part0.data'); return true }catch{ return false } })()
    expect(wroteX || wroteY).toBeTrue()
  })
})

