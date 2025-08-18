/**
 * @file Core vector database operations
 * 
 * This module implements the fundamental operations for VectorLite, providing
 * the essential CRUD and search functionality. Key operations include:
 * - Vector insertion with automatic index updates
 * - Vector retrieval by ID with metadata
 * - Similarity search across different ANN strategies
 * - Vector removal with proper cleanup
 * - Strategy switching and rebuilding
 * 
 * The module abstracts away strategy-specific details, providing a unified
 * interface that works consistently across bruteforce, HNSW, and IVF backends.
 * This separation ensures that users can switch strategies without changing
 * their application code.
 */
import type { SearchHit, SearchOptions, UpsertOptions, HNSWParams, IVFParams, VectorLiteOptions } from "../../types";
import {
  addOrUpdate,
  ensure as storeEnsure,
  get as storeGet,
  has as storeHas,
  normalizeQuery,
  removeById,
  size as storeSize,
  updateMeta as storeUpdateMeta,
} from "../../core/store";
import type { VectorLiteState } from "../../types";
import { bf_add, bf_search } from "../../ann/bruteforce";
import { hnsw_add, hnsw_remove, hnsw_search, hnsw_ensureCapacity } from "../../ann/hnsw";
import { ivf_add, ivf_remove, ivf_search } from "../../ann/ivf";
import { isHnswVL, isIvfVL, isBfVL } from "../../util/guards";
import { createVectorLiteState } from "../create";

/**
 *
 */
export function size<TMeta>(vl: VectorLiteState<TMeta>) {
  return storeSize(vl.store);
}
/**
 *
 */
export function has<TMeta>(vl: VectorLiteState<TMeta>, id: number) {
  return storeHas(vl.store, id);
}

/**
 *
 */
export function add<TMeta>(
  vl: VectorLiteState<TMeta>,
  id: number,
  vector: Float32Array,
  meta: TMeta | null = null,
  up?: UpsertOptions,
) {
  const grew = storeEnsure(vl.store, 1);
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity);
  const { created } = addOrUpdate(vl.store, id, vector, meta, up);
  if (created) {
    if (isHnswVL(vl)) hnsw_add(vl.ann, vl.store, id);
    else if (isIvfVL(vl)) ivf_add(vl.ann, vl.store, id);
    else if (isBfVL(vl)) bf_add();
  }
}

/**
 *
 */
export function addMany<TMeta>(
  vl: VectorLiteState<TMeta>,
  rows: { id: number; vector: Float32Array; meta?: TMeta | null }[],
  up?: UpsertOptions,
) {
  const grew = storeEnsure(vl.store, rows.length);
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity);
  for (const r of rows) add(vl, r.id, r.vector, r.meta ?? null, up);
}

/**
 *
 */
export function getOne<TMeta>(vl: VectorLiteState<TMeta>, id: number) {
  return storeGet(vl.store, id);
}
export const get = getOne;
/**
 *
 */
export function getMeta<TMeta>(vl: VectorLiteState<TMeta>, id: number): TMeta | null {
  const r = storeGet(vl.store, id);
  return r ? r.meta : null;
}
/**
 *
 */
export function setMeta<TMeta>(vl: VectorLiteState<TMeta>, id: number, meta: TMeta | null): boolean {
  return storeUpdateMeta(vl.store, id, meta);
}

/**
 *
 */
export function remove<TMeta>(vl: VectorLiteState<TMeta>, id: number): boolean {
  if (isHnswVL(vl)) {
    if (!has(vl, id)) return false;
    hnsw_remove(vl.ann, vl.store, id);
    return true;
  }
  if (isIvfVL(vl)) {
    if (!has(vl, id)) return false;
    ivf_remove(vl.ann, vl.store, id);
    return true;
  }
  const res = removeById(vl.store, id);
  return res !== null;
}

/**
 *
 */
export function search<TMeta>(
  vl: VectorLiteState<TMeta>,
  query: Float32Array,
  options: SearchOptions<TMeta> = {},
): SearchHit<TMeta>[] {
  const k = Math.max(1, options.k ?? 5);
  const q = normalizeQuery(vl.metric, query);
  if (isHnswVL(vl)) return hnsw_search(vl.ann, vl.store, q, { k, filter: options.filter });
  if (isIvfVL(vl)) return ivf_search(vl.ann, vl.store, q, k, options.filter);
  if (isBfVL(vl)) return bf_search(vl.ann, vl.store, q, k, options.filter);
  return [];
}

/** Build a new instance with a chosen strategy using the same data (no auto switch). */
export function buildWithStrategy<TMeta>(
  vl: VectorLiteState<TMeta>,
  next: "bruteforce" | "hnsw" | "ivf",
  params?: { hnsw?: HNSWParams; ivf?: IVFParams },
): VectorLiteState<TMeta> {
  const opts: VectorLiteOptions = {
    dim: vl.dim,
    metric: vl.metric,
    capacity: vl.store._capacity,
    strategy: next,
    hnsw: params?.hnsw,
    ivf: params?.ivf,
  };
  const out = createVectorLiteState<TMeta>(opts);
  // IVF: leave centroid seeding to maintain module (rebuildIndex) or training step
  for (let i = 0; i < vl.store._count; i++) {
    const id = vl.store.ids[i];
    const base = i * vl.dim;
    const vec = vl.store.data.subarray(base, base + vl.dim);
    const meta = vl.store.metas[i];
    add(out, id, new Float32Array(vec), meta);
  }
  return out;
}

/**
 *
 */
export function buildHNSWFromStore<TMeta>(vl: VectorLiteState<TMeta>, params?: HNSWParams): VectorLiteState<TMeta> {
  return buildWithStrategy(vl, "hnsw", { hnsw: params });
}

/**
 *
 */
export function buildIVFFromStore<TMeta>(vl: VectorLiteState<TMeta>, params?: IVFParams): VectorLiteState<TMeta> {
  return buildWithStrategy(vl, "ivf", { ivf: params });
}
