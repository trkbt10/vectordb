/**
 * Ops barrel: re-export split modules for a stable import path.
 */
export { size, has, add, addMany, getOne, get, getMeta, setMeta, remove, search, buildWithStrategy, buildHNSWFromStore, buildIVFFromStore } from './ops/core'
export { upsertMany, removeMany } from './ops/bulk'
export { hnswCompactAndRebuild, compactStore, rebuildIndex } from './ops/maintain'
export { stats, diagnose, type HnswStats, type IvfStats, type StatsOut } from './ops/stats'
export { checkConsistency, repairConsistency } from './ops/consistency'
export { trainIvfCentroids, reassignIvfLists, evaluateIvf } from './ops/ivf'
export { tuneHnsw, type HnswTuneGrid, type HnswTuneResult } from './ops/tune'
