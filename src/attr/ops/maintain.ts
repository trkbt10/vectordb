/**
 * @file Maintenance operations for VectorDB indices and storage
 *
 * This module provides explicit maintenance operations for optimizing VectorDB
 * performance and storage efficiency. It includes compaction (removing tombstoned
 * entries), full index rebuilds, IVF retraining, and capacity management. All
 * operations are designed to be explicitly invoked by operators rather than
 * happening automatically, ensuring predictable behavior and avoiding hidden
 * performance costs during normal operations.
 *
 * Key operations:
 * - HNSW compaction: Remove deleted entries and rebuild the graph
 * - IVF retraining: Recompute centroids and reassign vectors to optimal clusters
 * - Storage capacity adjustment: Grow or shrink backing arrays
 * - Full index rebuilds: Create fresh indices from scratch for optimal structure
 */

import { createHNSWState, hnsw_add } from "../../ann/hnsw";
import { createIVFState, ivf_trainCentroids, ivf_reassignLists, ivf_add } from "../../ann/ivf";
import { VectorStoreState, HNSWParams, IVFParams } from "../../types";
import { isHnswVL, isIvfVL } from "../../util/guards";
import { createStore, addOrUpdate, resizeCapacity, shrinkToFit, getByIndex } from "../store/store";

/**
 * Maintain/compact/rebuild operations.
 *
 * Why: Isolate maintenance workflows (compaction, rebuild, capacity tuning)
 * behind explicit, operator-invoked functions to avoid hidden mutations.
 */
/**
 *
 */
export function hnswCompactAndRebuild<TMeta>(vl: VectorStoreState<TMeta>): number {
  if (!isHnswVL(vl)) return 0;
  const h = vl.ann;
  const n = vl.store._count;
  if (n === 0) return 0;
  // eslint-disable-next-line no-restricted-syntax -- Performance: counting alive vectors for compaction
  let alive = 0;

  for (let i = 0; i < n; i++) {
    if (!h.tombstone[i]) alive++;
  }
  if (alive === n) return 0;
  const newStore = createStore<TMeta>(vl.dim, vl.metric, alive || 1);
  const newH = createHNSWState(
    {
      M: h.M,
      efConstruction: h.efConstruction,
      efSearch: h.efSearch,
      levelMult: h.levelMult,
      allowReplaceDeleted: h.allowReplaceDeleted,
      seed: 42,
    },
    vl.metric,
    alive || 1,
  );
  for (let i = 0; i < n; i++) {
    if (h.tombstone[i]) continue;
    const { id, vector, meta } = getByIndex(vl.store, i);
    addOrUpdate(newStore, id, vector, meta, { upsert: false });
  }
  for (let i = 0; i < newStore._count; i++) hnsw_add(newH, newStore, newStore.ids[i]);
  vl.store = newStore;
  vl.ann = newH;
  return n - alive;
}

/**
 *
 */
export function compactStore<TMeta>(
  vl: VectorStoreState<TMeta>,
  opts?: { shrink?: boolean; tombstoneRatio?: number; capacity?: number },
): { shrunk: boolean; rebuilt: number } {
  // eslint-disable-next-line no-restricted-syntax -- Performance: tracking rebuild count
  let rebuilt = 0;
  const ratio = opts?.tombstoneRatio;
  if (isHnswVL(vl) && typeof ratio === "number") {
    const h = vl.ann;
    const n = vl.store._count;
    // eslint-disable-next-line no-restricted-syntax -- Performance: counting dead vectors
    let dead = 0;

    for (let i = 0; i < n; i++) if (h.tombstone[i] === 1) dead++;
    if (n > 0 && dead / n > ratio) rebuilt = hnswCompactAndRebuild(vl);
  }
  // eslint-disable-next-line no-restricted-syntax -- Performance: tracking shrink status
  let shrunk = false;
  if (typeof opts?.capacity === "number") {
    resizeCapacity(vl.store, opts.capacity);
    shrunk = true;
  }
  if (opts?.shrink && typeof opts?.capacity !== "number") {
    shrinkToFit(vl.store);
    shrunk = true;
  }
  return { shrunk, rebuilt };
}

/**
 *
 */
export function rebuildIndex<TMeta>(
  vl: VectorStoreState<TMeta>,
  opts: { strategy: "hnsw" | "ivf"; params?: HNSWParams | IVFParams; ids?: number[] },
): number {
  const ids = opts.ids && opts.ids.length ? Array.from(opts.ids) : null;
  if (opts.strategy === "hnsw") return rebuildHnsw(vl, opts.params as HNSWParams | undefined, ids);
  return rebuildIvf(vl, opts.params as IVFParams | undefined, ids);
}

function computeHnswParams(
  old: unknown,
  params: HNSWParams | undefined,
  fallback: { M: number; efConstruction: number; efSearch: number },
): HNSWParams {
  if (params) return params;
  // old may be null; caller passes appropriately typed values
  if (old) {
    const h = old as unknown as { M: number; efConstruction: number; efSearch: number; levelMult: number; allowReplaceDeleted: boolean };
    return { M: h.M, efConstruction: h.efConstruction, efSearch: h.efSearch, levelMult: h.levelMult, allowReplaceDeleted: h.allowReplaceDeleted, seed: 42 } as HNSWParams;
  }
  return fallback as HNSWParams;
}

function rebuildHnsw<TMeta>(vl: VectorStoreState<TMeta>, params: HNSWParams | undefined, ids: number[] | null): number {
  const old = isHnswVL(vl) ? vl.ann : null;
  const p = computeHnswParams(old as never, params, { M: 16, efConstruction: 200, efSearch: 50 });
  const newH = createHNSWState(p, vl.metric, vl.store._count || 1);
  vl.strategy = "hnsw";
  vl.ann = newH;
  if (isHnswVL(vl)) {
    if (!ids) {
      for (let i = 0; i < vl.store._count; i++) hnsw_add(vl.ann, vl.store, vl.store.ids[i]);
    }
    if (ids) {
      for (const id of ids) hnsw_add(vl.ann, vl.store, id);
    }
  }
  return ids ? ids.length : vl.store._count;
}

function rebuildIvf<TMeta>(vl: VectorStoreState<TMeta>, params: IVFParams | undefined, ids: number[] | null): number {
  const old = isIvfVL(vl) ? vl.ann : null;
  const next: IVFParams = params ?? (old ? { nlist: old.nlist, nprobe: old.nprobe } : { nlist: 64, nprobe: 8 });
  const needRecreate = !old || (typeof next.nlist === "number" && next.nlist !== old.nlist);
  if (needRecreate) {
    const newI = createIVFState(next, vl.metric, vl.dim);
    vl.strategy = "ivf";
    vl.ann = newI;
  }
  if (!needRecreate && old && typeof next.nprobe === "number") {
    old.nprobe = Math.max(1, Math.min(old.nlist, next.nprobe));
  }
  if (!isIvfVL(vl)) return 0;
  const trained = ivf_trainCentroids(vl.ann, vl.store);
  if (!ids) {
    ivf_reassignLists(vl.ann, vl.store);
    return trained.updated;
  }
  for (const id of ids) {
    const at = vl.store.pos.get(id);
    if (at === undefined) continue;
    const li = vl.ann.idToList.get(id);
    if (li !== undefined) {
      const arr = vl.ann.lists[li];
      const pos = arr.indexOf(id);
      if (pos >= 0) arr.splice(pos, 1);
    }
    ivf_add(vl.ann, vl.store, id);
  }
  return ids.length;
}
