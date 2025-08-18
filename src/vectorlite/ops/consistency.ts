/**
 * Consistency check/repair between store and indices.
 *
 * Why: Detect and optionally fix drift between primary storage and
 * secondary indices without coupling repair logic to write paths.
 */
import type { VectorLiteState } from '../state'
import { isIvfVL } from '../../util/guards'
import { ivf_add } from '../../ann/ivf'

export function checkConsistency<TMeta>(vl: VectorLiteState<TMeta>) {
  const missingInIndex: number[] = []
  const missingInStore: number[] = []
  const mismatchedPos: number[] = []
  if (isIvfVL(vl)) {
    const idToList = vl.ann.idToList
    for (let i = 0; i < vl.store._count; i++) {
      const id = vl.store.ids[i]
      if (!idToList.has(id)) missingInIndex.push(id)
    }
  }
  // HNSW/Bruteforce: store.pos mismatch detection
  for (let i = 0; i < vl.store._count; i++) {
    const id = vl.store.ids[i]
    const at = vl.store.pos.get(id)
    if (at !== i) mismatchedPos.push(id)
  }
  return { missingInIndex, missingInStore, mismatchedPos }
}

export function repairConsistency<TMeta>(vl: VectorLiteState<TMeta>, opts?: { fixIndex?: boolean; fixStore?: boolean }) {
  const report = checkConsistency(vl)
  if (opts?.fixIndex) {
    if (isIvfVL(vl)) {
      vl.ann.idToList.clear()
      for (const lst of vl.ann.lists) lst.splice(0, lst.length)
      for (let i = 0; i < vl.store._count; i++) ivf_add(vl.ann, vl.store, vl.store.ids[i])
    }
  }
  return report
}
