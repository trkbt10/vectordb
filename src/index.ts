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

import type { VectorLiteOptions } from "./types";
import type { VectorLiteState } from "./types";
import {
  createVectorLiteState,
  deserializeVectorLite,
  size,
  has,
  add,
  addMany,
  getOne,
  get,
  getMeta,
  setMeta,
  remove,
  search,
  buildHNSWFromStore,
  buildIVFFromStore,
} from "./vectorlite";

export type {
  Metric,
  VectorLiteInit,
  UpsertOptions,
  SearchOptions,
  SearchHit,
  VectorLiteOptions,
  HNSWParams,
  IVFParams,
  VectorLiteAnn,
  VectorLiteState,
} from "./types";

// Internal helper to attach client methods to an existing state
function attachClient<TMeta>(state: VectorLiteState<TMeta>) {
  return {
    state,
    size,
    has,
    add,
    addMany,
    getOne,
    get,
    getMeta,
    setMeta,
    remove,
    search,
  };
}

// Derive client type from attachClient's return type to avoid duplication
export type VLiteClient = ReturnType<typeof attachClient>;

/** Create a new client instance (ergonomic API). */
export function createVectorLite<TMeta = unknown>(opts: VectorLiteOptions): VLiteClient {
  return attachClient<TMeta>(createVectorLiteState<TMeta>(opts));
}

export const vlite = {
  create: createVectorLite,
  buildHNSWFromStore,
  buildIVFFromStore,
  from<TMeta = unknown>(state: VectorLiteState<TMeta>): VLiteClient {
    return attachClient<TMeta>(state);
  },
  open<TMeta = unknown>(buf: ArrayBuffer): VLiteClient {
    return attachClient<TMeta>(deserializeVectorLite<TMeta>(buf));
  },
};
