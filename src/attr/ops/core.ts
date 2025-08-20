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
import { bf_add, bf_search } from "../../ann/bruteforce";
import { hnsw_ensureCapacity, hnsw_add, hnsw_remove, hnsw_search } from "../../ann/hnsw";
import { ivf_add, ivf_remove, ivf_search } from "../../ann/ivf";
import {
  VectorStoreState,
  UpsertOptions,
  SearchOptions,
  SearchHit,
  HNSWParams,
  IVFParams,
  VectorLiteOptions,
} from "../../types";
import { isHnswVL, isIvfVL, isBfVL } from "../../util/guards";
import { createState } from "../state/create";
import * as Store from "../store/store";
/**
 *
 */
export function size<TMeta>(vl: VectorStoreState<TMeta>) {
  return Store.size(vl.store);
}
/**
 *
 */
export function has<TMeta>(vl: VectorStoreState<TMeta>, id: number) {
  return Store.has(vl.store, id);
}

/**
 *
 */
export function add<TMeta>(
  vl: VectorStoreState<TMeta>,
  id: number,
  vector: Float32Array,
  meta: TMeta | null = null,
  up?: UpsertOptions,
) {
  const grew = Store.ensure(vl.store, 1);
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity);
  const { created } = Store.addOrUpdate(vl.store, id, vector, meta, up);
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
  vl: VectorStoreState<TMeta>,
  rows: { id: number; vector: Float32Array; meta?: TMeta | null }[],
  up?: UpsertOptions,
) {
  const grew = Store.ensure(vl.store, rows.length);
  if (grew && isHnswVL(vl)) hnsw_ensureCapacity(vl.ann, vl.store._capacity);
  for (const r of rows) add(vl, r.id, r.vector, r.meta ?? null, up);
}

/**
 *
 */
export function getOne<TMeta>(vl: VectorStoreState<TMeta>, id: number) {
  return Store.get(vl.store, id);
}
/**
 *
 */
export function getMeta<TMeta>(vl: VectorStoreState<TMeta>, id: number): TMeta | null {
  const r = Store.get(vl.store, id);
  return r ? r.meta : null;
}
/**
 *
 */
export function setMeta<TMeta>(vl: VectorStoreState<TMeta>, id: number, meta: TMeta | null): boolean {
  return Store.updateMeta(vl.store, id, meta);
}

/**
 *
 */
export function remove<TMeta>(vl: VectorStoreState<TMeta>, id: number): boolean {
  if (isHnswVL(vl)) {
    if (!has(vl, id)) return false;
    hnsw_remove(vl.ann, vl.store, id);
    return true;
  }
  if (isIvfVL(vl)) {
    if (!has(vl, id)) return false;
    ivf_remove(vl.ann, id);
    return true;
  }
  const res = Store.removeById(vl.store, id);
  return res !== null;
}

/**
 *
 */
export function search<TMeta>(
  vl: VectorStoreState<TMeta>,
  query: Float32Array,
  options: SearchOptions<TMeta> = {},
): SearchHit<TMeta>[] {
  const k = Math.max(1, options.k ?? 5);
  const q = Store.normalizeQuery(vl.metric, query);
  if (isHnswVL(vl)) return hnsw_search(vl.ann, vl.store, q, { k, filter: options.filter });
  if (isIvfVL(vl)) return ivf_search(vl.ann, vl.store, q, k, options.filter);
  if (isBfVL(vl)) return bf_search(vl.ann, vl.store, q, k, options.filter);
  return [];
}

/** Build a new instance with a chosen strategy using the same data (no auto switch). */
export function buildWithStrategy<TMeta>(
  vl: VectorStoreState<TMeta>,
  next: "bruteforce" | "hnsw" | "ivf",
  params?: { hnsw?: HNSWParams; ivf?: IVFParams },
): VectorStoreState<TMeta> {
  const opts: VectorLiteOptions = {
    dim: vl.dim,
    metric: vl.metric,
    capacity: vl.store._capacity,
    strategy: next,
    hnsw: params?.hnsw,
    ivf: params?.ivf,
  };
  const out = createState<TMeta>(opts);
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
export function buildHNSWFromStore<TMeta>(vl: VectorStoreState<TMeta>, params?: HNSWParams): VectorStoreState<TMeta> {
  return buildWithStrategy(vl, "hnsw", { hnsw: params });
}

/**
 *
 */
export function buildIVFFromStore<TMeta>(vl: VectorStoreState<TMeta>, params?: IVFParams): VectorStoreState<TMeta> {
  return buildWithStrategy(vl, "ivf", { ivf: params });
}
