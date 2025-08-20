/**
 * @file Client facade: thin wrappers over core ops
 *
 * Subject: Client constructors and adapters
 * - attachClient: Wraps an existing VectorStoreState with a VLiteClient view
 * - createClient: Creates a new VectorStoreState and returns a VLiteClient
 *
 * Object: VectorStoreState and VLiteClient
 * - VectorStoreState holds vectors, metas, and ANN strategy state
 * - VLiteClient forwards operations to core (add/remove/search), no copies
 */
import type { VectorDB } from "./types";
import type { SearchOptions, UpsertOptions, VectorDBOptions, VectorStoreState } from "../types";
import { add, remove, search, size, has, getOne as coreGet } from "../attr/ops/core";
import { upsertMany } from "../attr/ops/bulk";
import { createState } from "../attr/state/create";

const BULK_THRESHOLD = 8;

/**
 * Attach a VLiteClient facade to the given VectorStoreState.
 * Subject: This function attaches a facade.
 * Object: The provided state becomes the backing store for the returned client.
 * Responsibility: The client delegates operations to core; it does not own persistence.
 */
export function fromState<TMeta>(state: VectorStoreState<TMeta>): VectorDB<TMeta> {
  function isVec(x: Float32Array | { vector: Float32Array; meta?: TMeta | null }): x is Float32Array {
    return x instanceof Float32Array;
  }
  const client: VectorDB<TMeta> = {
    state,
    get size() {
      return size(state);
    },
    has: (id: number) => has(state, id),
    get: (id: number) => coreGet(state, id),
    set: (
      id: number,
      vOrRec: Float32Array | { vector: Float32Array; meta?: TMeta | null },
      meta?: TMeta | null,
      opts?: UpsertOptions,
    ) => {
      const vector = isVec(vOrRec) ? vOrRec : vOrRec.vector;
      const m = isVec(vOrRec) ? meta ?? null : vOrRec.meta ?? null;
      add(state, id, vector, m, opts);
      return client;
    },
    delete: (id: number) => remove(state, id),
    push: (
      rowOrRows:
        | { id: number; vector: Float32Array; meta?: TMeta | null }
        | Array<{ id: number; vector: Float32Array; meta?: TMeta | null }>,
      opts?: UpsertOptions,
    ) => {
      if (Array.isArray(rowOrRows)) {
        if (rowOrRows.length >= BULK_THRESHOLD) {
          const res = upsertMany(state, rowOrRows, { upsert: opts?.upsert ?? true, mode: "best_effort" });
          return res.ok;
        }
        for (const r of rowOrRows) add(state, r.id, r.vector, r.meta ?? null, opts);
        return rowOrRows.length;
      }
      add(state, rowOrRows.id, rowOrRows.vector, rowOrRows.meta ?? null, opts);
      return 1;
    },
    search: (q: Float32Array, opts?: SearchOptions<TMeta>) => search(state, q, opts ?? {}),
    find: (q: Float32Array, opts?: SearchOptions<TMeta>) => {
      const out = search(state, q, { ...(opts ?? {}), k: 1 });
      return out.length > 0 ? out[0] : null;
    },
    findK: (q: Float32Array, k: number, opts?: Omit<SearchOptions<TMeta>, "k">) => {
      const kk = Math.max(1, k | 0);
      return search(state, q, { ...(opts ?? {}), k: kk });
    },
  };
  return client;
}

/**
 * Create a new VectorDB backed by a freshly allocated VectorStoreState.
 * Subject: This function creates a new client.
 * Object: The returned client owns the newly created state (in-memory).
 * Responsibility: Optionally seeds initial rows before returning the client.
 */
export function create<TMeta = unknown>(
  opts: VectorDBOptions,
  seed?: Array<{ id: number; vector: Float32Array; meta: TMeta | null }>,
): VectorDB<TMeta> {
  const client = fromState<TMeta>(createState<TMeta>(opts));
  if (Array.isArray(seed)) {
    for (const r of seed) client.set(r.id, r.vector, r.meta ?? null);
  }
  return client;
}
