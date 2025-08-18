/**
 * VectorLite: minimal, dependency-free vector store with pluggable ANN.
 *
 * Why: Provide a single, documented public surface for applications while the
 * internal implementation is split into small modules (create/ops/serialize).
 * This file curates and documents the API; it is not a blind re-export.
 */

import type { VectorLiteState as _VectorLiteState } from './vectorlite/state'
import { createVectorLite as _createVectorLite } from './vectorlite/create'
import {
  size as _size,
  has as _has,
  add as _add,
  addMany as _addMany,
  getOne as _getOne,
  get as _get,
  getMeta as _getMeta,
  setMeta as _setMeta,
  remove as _remove,
  search as _search,
  hnswCompactAndRebuild as _hnswCompactAndRebuild,
} from './vectorlite/ops'
import { serialize as _serialize, deserializeVectorLite as _deserializeVectorLite } from './vectorlite/serialize'
import { searchWithExpr as _searchWithExpr } from './search/with_expr'

export type VectorLiteState<TMeta> = _VectorLiteState<TMeta>

/** Create a new VectorLite state (choose bruteforce or HNSW). */
export const createVectorLite = _createVectorLite

/** Return number of vectors stored. */
export const size = _size
/** Check whether an id exists. */
export const has = _has
/** Add or update a vector+meta (set opts.upsert=true to overwrite). */
export const add = _add
/** Bulk add helper. */
export const addMany = _addMany
/** Get vector+meta for id, or null. */
export const getOne = _getOne
/** Alias of getOne. */
export const get = _get
/** Get only meta for id (null if missing). */
export const getMeta = _getMeta
/** Set only meta for id. Returns true if updated. */
export const setMeta = _setMeta
/** Remove by id (HNSW marks tombstone; bruteforce compacts). */
export const remove = _remove
/** KNN search (cosine or l2 negative distance; larger is closer). */
export const search = _search
/** Compact and rebuild HNSW graph removing tombstones. */
export const hnswCompactAndRebuild = _hnswCompactAndRebuild

/** Serialize a VectorLite state (binary v2). */
export const serialize = _serialize
/** Deserialize a VectorLite state from binary. */
export const deserializeVectorLite = _deserializeVectorLite

/** Expression-based search with optional attribute index integration. */
export const searchWithExpr = _searchWithExpr
