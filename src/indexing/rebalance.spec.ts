/**
 * @file Rebalance plan/apply test: change crushmap and relocate segments
 */
import { describe, it, expect } from 'bun:test'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join as joinPath } from 'node:path'
import { createVectorLiteState } from '../vectorlite/create'
import { persistIndex, openFromIndex } from '../vectorlite/ops/index_persist'
import { createLocalCrushEnv } from './local_crush'
import { planRebalance, applyRebalance } from './rebalance'

describe('indexing/rebalance', () => {
  it('moves segments to satisfy new crushmap and opens with updated placement', async () => {
    const base = await mkdtemp(joinPath(tmpdir(), 'vlite-rebal-'))
    const env = createLocalCrushEnv(base, 2, 16)
    const vl = createVectorLiteState({ dim: 2, metric: 'cosine', strategy: 'bruteforce' })
    for (let i=0;i<10;i++){ vl.store.ids[i]=i+1; vl.store.data.set(new Float32Array([i,i+1]), i*2); vl.store.metas[i]=null; vl.store.pos.set(i+1,i); vl.store._count=i+1 }
    await persistIndex(vl, { baseName: 'db', crush: env.crush, resolveDataIO: env.resolveDataIO, resolveIndexIO: env.resolveIndexIO, segmented: true, segmentBytes: 1<<15 })

    // New crush with more shards
    const env2 = createLocalCrushEnv(base, 4, 16)
    const manifestIo = env.resolveIndexIO()
    const mbytes = await manifestIo.read('db.manifest.json')
    const manifest = JSON.parse(new TextDecoder().decode(mbytes)) as { segments: { name: string; targetKey: string }[] }
    const plan = planRebalance(manifest, env2.crush)
    // Apply moves
    await applyRebalance('db', plan, { resolveDataIO: env2.resolveDataIO, resolveIndexIO: env2.resolveIndexIO })

    // Verify some .data exist under new shard dirs
    const dataRoot = joinPath(base, 'data')
    const shards = await readdir(dataRoot)
    let files = 0 // eslint-disable-line no-restricted-syntax -- accumulation in test
    for (const sh of shards) { const entries = await readdir(joinPath(dataRoot, sh)); files += entries.filter(n=>n.endsWith('.data')).length }
    expect(files).toBeGreaterThan(0)

    // Open with new crush
    const vl2 = await openFromIndex({ baseName: 'db', crush: env2.crush, resolveDataIO: env2.resolveDataIO, resolveIndexIO: env2.resolveIndexIO })
    expect(vl2.store._count).toBe(10)
  })
})
