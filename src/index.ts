/**
 * @file Main entry point and public API for VectorLite
 *
 * This module serves as the primary interface for VectorLite users, providing:
 * - A fluent, database-like API for vector operations (create, add, search, etc.)
 * - Tree-shakable exports of individual operations for optimal bundle sizes
 * - Type-safe wrappers around the core VectorLite functionality
 * - Support for both class-based and functional usage patterns
 *
 * The API is designed to be intuitive for developers familiar with traditional
 * databases while exposing the unique capabilities of vector similarity search.
 * Users can choose between the convenient class-based API or import individual
 * functions for more granular control and smaller bundle sizes.
 */

import type { SearchHit, SearchOptions, VectorLiteOptions } from "./types";
import type { VectorLiteState } from "./types";
import {
  createVectorLiteState,
  deserializeVectorLite,
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
  buildHNSWFromStore as _buildHNSWFromStore,
  buildIVFFromStore as _buildIVFFromStore,
} from "./vectorlite";

export type { VectorLiteState } from "./types";
export type { VectorLiteOptions, HNSWParams, Metric } from "./types";
// Do not re-export operational functions from here to avoid API duplication.

// DB-like ergonomic wrapper ---------------------------------------------------

export type VLiteClient<TMeta = unknown> = {
  state: VectorLiteState<TMeta>;
  // CRUD-ish
  add(id: number, vector: Float32Array, meta?: TMeta | null): void;
  addMany(rows: { id: number; vector: Float32Array; meta?: TMeta | null }[]): void;
  getOne(id: number): { vector: Float32Array; meta: TMeta | null } | null;
  get(id: number): { vector: Float32Array; meta: TMeta | null } | null;
  getMeta(id: number): TMeta | null;
  setMeta(id: number, meta: TMeta | null): boolean;
  remove(id: number): boolean;
  has(id: number): boolean;
  size(): number;
  // Query
  findMany(query: Float32Array, opts?: SearchOptions<TMeta>): SearchHit<TMeta>[];
  search(query: Float32Array, opts?: SearchOptions<TMeta>): SearchHit<TMeta>[];
  // Strategy rebuild helpers
  toHnsw(params?: Parameters<typeof _buildHNSWFromStore>[1]): VLiteClient<TMeta>;
  toIvf(params?: Parameters<typeof _buildIVFFromStore>[1]): VLiteClient<TMeta>;
};

// Internal helper to attach client methods to an existing state
function attachClient<TMeta>(state: VectorLiteState<TMeta>): VLiteClient<TMeta> {
  return {
    state,
    add: (id, vector, meta = null) => _add(state, id, vector, meta),
    addMany: (rows) => _addMany(state, rows),
    getOne: (id) => _getOne(state, id),
    get: (id) => _get(state, id),
    getMeta: (id) => _getMeta(state, id),
    setMeta: (id, meta) => _setMeta(state, id, meta),
    remove: (id) => _remove(state, id),
    has: (id) => _has(state, id),
    size: () => _size(state),
    findMany: (q, opts) => _search(state, q, opts),
    search: (q, opts) => _search(state, q, opts),
    toHnsw: (params) => attachClient(_buildHNSWFromStore(state, params)),
    toIvf: (params) => attachClient(_buildIVFFromStore(state, params)),
  };
}

/** Create a new client instance (ergonomic API). */
export function createVectorLite<TMeta = unknown>(opts: VectorLiteOptions): VLiteClient<TMeta> {
  return attachClient<TMeta>(createVectorLiteState<TMeta>(opts));
}

export const vlite = {
  create: createVectorLite,
  from<TMeta = unknown>(state: VectorLiteState<TMeta>): VLiteClient<TMeta> {
    return attachClient<TMeta>(state);
  },
  open<TMeta = unknown>(buf: ArrayBuffer): VLiteClient<TMeta> {
    return attachClient<TMeta>(deserializeVectorLite<TMeta>(buf));
  },
};
