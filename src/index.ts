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

import type {
  VectorLiteOptions,
  VectorLiteState,
  SearchHit,
  SearchOptions,
  UpsertOptions,
  VectorRecord,
} from "./types";
import { saveIndexing, openIndexing, rebuildIndexingFromData } from "./indexing/runtime/manager";
import type { SaveIndexingOptions, OpenIndexingOptions, CrushMap } from "./indexing/types";
import { planRebalance, applyRebalance } from "./indexing/placement/rebalance";
import type { FileIO } from "./persist/types";
import { get, add, addMany, getOne, getMeta, setMeta, remove, search, size, has } from "./attr/ops/core";
import { createState } from "./attr/state/create";
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
export type { SaveIndexingOptions, OpenIndexingOptions, CrushMap };

// Internal helper to attach client methods to an existing state
function attachClient<TMeta>(state: VectorLiteState<TMeta>): VLiteClient<TMeta> {
  return {
    state,
    size: () => size(state),
    has: (id: number) => has(state, id),
    add: (id: number, v: Float32Array, meta?: TMeta | null, opts?: UpsertOptions) =>
      add(state, id, v, meta ?? null, opts),
    addMany: (rows: Array<{ id: number; vector: Float32Array; meta?: TMeta | null }>, opts?: UpsertOptions) =>
      addMany(state, rows, opts),
    getOne: (id: number) => getOne(state, id),
    get: (id: number) => get(state, id),
    getMeta: (id: number) => getMeta(state, id),
    setMeta: (id: number, meta: TMeta | null) => setMeta(state, id, meta),
    remove: (id: number) => remove(state, id),
    search: (q: Float32Array, opts?: SearchOptions<TMeta>) => search(state, q, opts ?? {}),
  };
}

// Derive client type from attachClient's return type to avoid duplication
export type VLiteClient<TMeta = unknown> = {
  state: VectorLiteState<TMeta>;
  size: () => number;
  has: (id: number) => boolean;
  add: (id: number, v: Float32Array, meta?: TMeta | null, opts?: UpsertOptions) => void;
  addMany: (rows: Array<{ id: number; vector: Float32Array; meta?: TMeta | null }>, opts?: UpsertOptions) => void;
  getOne: (id: number) => VectorRecord<TMeta> | null;
  get: (id: number) => VectorRecord<TMeta> | null;
  getMeta: (id: number) => TMeta | null;
  setMeta: (id: number, meta: TMeta | null) => boolean;
  remove: (id: number) => boolean;
  search: (q: Float32Array, opts?: SearchOptions<TMeta>) => SearchHit<TMeta>[];
};

/** Create a new client instance (ergonomic API). */
export function createVectorLite<TMeta>(
  opts: VectorLiteOptions,
  seed: Array<{ id: number; vector: Float32Array; meta: TMeta | null }>,
): VLiteClient<TMeta>;
export function createVectorLite<TMeta = unknown>(opts: VectorLiteOptions): VLiteClient<TMeta>;
export function createVectorLite<TMeta = unknown>(
  opts: VectorLiteOptions,
  seed?: Array<{ id: number; vector: Float32Array; meta: TMeta | null }>,
): VLiteClient<TMeta> {
  const client = attachClient<TMeta>(createState<TMeta>(opts));
  if (Array.isArray(seed)) {
    client.addMany(seed);
  }
  return client;
}

// -------- Local persistence helpers (quality-of-life) --------

export type LocalEnvOptions = Partial<Pick<SaveIndexingOptions, "segmented" | "segmentBytes" | "includeAnn">> & {
  shards?: number;
  pgs?: number;
  replicas?: number;
};

/**
 * Create a bound environment using injected persistence adapters.
 * Pass FileIO instances (or factories) instead of filesystem paths.
 */
export function vlite<
  TMeta extends {
    [key: string]: unknown;
  },
>(persist: { index: FileIO; data: FileIO | ((targetKey: string) => FileIO) }, defaults: LocalEnvOptions = {}) {
  const shards = Math.max(1, defaults.shards ?? 1);
  const pgs = Math.max(1, defaults.pgs ?? 64);
  const replicas = Math.max(1, defaults.replicas ?? 1);
  const targets = Array.from({ length: shards }, (_, i) => ({ key: String(i) }));
  const env = {
    crush: { pgs, replicas, targets },
    resolveIndexIO: () => persist.index,
    resolveDataIO: (key: string) => (typeof persist.data === "function" ? persist.data(key) : persist.data),
  };
  const mergedSave = (over?: Partial<Pick<SaveIndexingOptions, "segmented" | "segmentBytes" | "includeAnn">>) => ({
    segmented: over?.segmented ?? defaults.segmented ?? true,
    segmentBytes: over?.segmentBytes ?? defaults.segmentBytes ?? 1 << 20,
    includeAnn: over?.includeAnn ?? defaults.includeAnn ?? false,
  });
  function isClient(x: VLiteClient<TMeta> | VectorLiteState<TMeta>): x is VLiteClient<TMeta> {
    return typeof (x as VLiteClient<TMeta>).state !== "undefined";
  }
  return {
    db: {
      /** Create an in-memory client; use index.save() to persist. */
      create(
        opts: VectorLiteOptions,
        seed?: Array<{ id: number; vector: Float32Array; meta: TMeta | null }>,
      ): VLiteClient<TMeta> {
        return createVectorLite<TMeta>(opts, seed);
      },
      /** Attach client helpers to an existing state. */
      from(state: VectorLiteState<TMeta>): VLiteClient<TMeta> {
        return attachClient<TMeta>(state);
      },
    },
    index: {
      /** Persist a client/state into this environment. */
      async save(
        clientOrState: VLiteClient<TMeta> | VectorLiteState<TMeta>,
        args: { baseName: string } & Partial<SaveIndexingOptions>,
      ) {
        const state = isClient(clientOrState)
          ? (clientOrState as VLiteClient<TMeta>).state
          : (clientOrState as VectorLiteState<TMeta>);
        const saveOpts: SaveIndexingOptions = {
          baseName: args.baseName,
          crush: env.crush,
          resolveDataIO: env.resolveDataIO,
          resolveIndexIO: env.resolveIndexIO,
          ...mergedSave(args),
        };
        await saveIndexing(state, saveOpts);
      },
      /** Open state from persisted index in this environment. */
      async openState(args: { baseName: string }): Promise<VectorLiteState<TMeta>> {
        return await openIndexing<TMeta>({
          baseName: args.baseName,
          crush: env.crush,
          resolveDataIO: env.resolveDataIO,
          resolveIndexIO: env.resolveIndexIO,
        });
      },
      /** Rebuild state from data (when index is missing/corrupt or to drop ANN bytes). */
      async rebuildState(args: { baseName: string }): Promise<VectorLiteState<TMeta>> {
        return await rebuildIndexingFromData<TMeta>({
          baseName: args.baseName,
          crush: env.crush,
          resolveDataIO: env.resolveDataIO,
          resolveIndexIO: env.resolveIndexIO,
        });
      },
      /** Maintenance helpers bound to this environment */
      planRebalance: (manifest: { segments: { name: string; targetKey: string }[] }) =>
        planRebalance(manifest, env.crush),
      applyRebalance: async (
        baseName: string,
        plan: Parameters<typeof applyRebalance>[1],
        opts?: { verify?: boolean; cleanup?: boolean },
      ) =>
        applyRebalance(baseName, plan, {
          resolveDataIO: env.resolveDataIO,
          resolveIndexIO: env.resolveIndexIO,
          verify: opts?.verify,
          cleanup: opts?.cleanup,
        }),
    },
  };
}
