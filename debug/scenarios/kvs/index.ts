/**
 * @file Debug scenario for KVS-backed workflows.
 */

/**
 * VectorLite KVS Demo (console-based)
 * - Demonstrates id-indexed get/getMeta/setMeta/remove
 * - Verifies map stability across compaction (removeById swaps last)
 */
import { createVectorLite } from '../../../src/vectorlite/create'
import { size, add, get as getRecord, getMeta, setMeta, remove, search } from '../../../src/vectorlite/ops/core'

type Meta = { tag?: string }

const ts = () => new Date().toISOString().split('T')[1].replace('Z', '')
const log = (m: string) => console.log(`[${ts()}] ${m}`)

async function main() {
  console.log('VectorLite KVS Demo — console mode')
  const db = createVectorLite<Meta>({ dim: 3, metric: 'cosine' })
  log(`init size=${size(db)}`)

  // Add a few records
  add(db, 1, new Float32Array([1, 0, 0]), { tag: 'a1' })
  add(db, 2, new Float32Array([0, 1, 0]), { tag: 'b2' })
  add(db, 3, new Float32Array([0, 0, 1]), { tag: 'c3' })
  log(`added ids [1,2,3] size=${size(db)}`)

  // KVS get (vector+meta)
  const r1 = getRecord(db, 1)
  log(`get(1) -> meta=${JSON.stringify(r1?.meta)} vecLen=${r1?.vector.length ?? 0}`)

  // getMeta / setMeta
  log(`getMeta(2) before -> ${JSON.stringify(getMeta(db, 2))}`)
  const ok = setMeta(db, 2, { tag: 'b2-updated' })
  log(`setMeta(2, b2-updated) -> ${ok}`)
  log(`getMeta(2) after -> ${JSON.stringify(getMeta(db, 2))}`)

  // Update vector by id using upsert
  add(db, 1, new Float32Array([0.9, 0, 0]), { tag: 'a1-up' }, { upsert: true })
  const r1b = getRecord(db, 1)
  log(`upsert(1) -> meta=${JSON.stringify(r1b?.meta)} dot([1,0,0])≈${(r1b ? r1b.vector[0] : 0).toFixed(2)}`)

  // Remove middle id to trigger compaction and verify other ids are intact
  remove(db, 2)
  log(`remove(2) size=${size(db)}`)
  log(`get(2) -> ${JSON.stringify(getRecord(db, 2))}`)
  log(`get(1) -> meta=${JSON.stringify(getRecord(db, 1)?.meta)}`)
  log(`get(3) -> meta=${JSON.stringify(getRecord(db, 3)?.meta)}`)

  // Add another id so last-move compaction is exercised differently
  add(db, 4, new Float32Array([0.8, 0, 0]), { tag: 'd4' })
  log(`added id=4 size=${size(db)}`)

  // Remove a non-last id again to test mapping stability
  remove(db, 3)
  log(`remove(3) size=${size(db)}`)
  log(`get(3) -> ${JSON.stringify(getRecord(db, 3))}`)
  log(`get(1) -> meta=${JSON.stringify(getRecord(db, 1)?.meta)}`)
  log(`get(4) -> meta=${JSON.stringify(getRecord(db, 4)?.meta)}`)

  // Quick search sanity
  const hits = search(db, new Float32Array([1, 0, 0]), { k: 3 })
  log(`search([1,0,0]) -> [${hits.map(h => `${h.id}:${h.meta?.tag ?? ''}`).join(', ')}]`)

  console.log('\nDone.')
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
/**
 * @file Debug scenario for KVS-backed workflows.
 */
