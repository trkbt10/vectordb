/**
 * @file DB operations (client-side, in-memory)
 */
import type { VectorDB } from "./types";
import type { VectorStoreState, UpsertOptions, SearchHit, RowInput, VectorInput } from "../types";
import type { FindManyOptions, FindOptions } from "./types";
import { add, remove, search, size, has, getOne as coreGet, setMeta as coreSetMeta } from "../attr/ops/core";
import { searchWithExpr } from "../attr/search/with_expr";
import { upsertMany } from "../attr/ops/bulk";

const BULK_THRESHOLD = 8;

/**
 * Create a VectorDatabase facade from a given state.
 * Why: keep state shape decoupled from the method surface so we can evolve internals without breaking callers.
 */
export function createDatabaseFromState<TMeta>(state: VectorStoreState<TMeta>): VectorDB<TMeta> {
  function doFindMany(q: Float32Array, opts?: FindManyOptions<TMeta>): SearchHit<TMeta>[] {
    const k = Math.max(1, opts?.k ?? 5);
    if (opts?.expr) {
      const hits = searchWithExpr(state, q, opts.expr, { k, ...(opts.exprOpts ?? {}) });
      return opts.filter ? hits.filter((h) => opts.filter!(h.id, h.meta)) : hits;
    }
    return search(state, q, { k, filter: opts?.filter });
  }
  function doFind(q: Float32Array, opts?: FindOptions<TMeta>): SearchHit<TMeta> | null {
    const out = doFindMany(q, { ...(opts ?? {}), k: 1 });
    return out.length > 0 ? out[0] : null;
  }
  const client: VectorDB<TMeta> = {
    state,
    get size() {
      return size(state);
    },
    has: (id: number) => has(state, id),
    get: (id: number) => coreGet(state, id),
    set: (id: number, input: VectorInput<TMeta>, opts?: UpsertOptions) => {
      add(state, id, input.vector, input.meta ?? null, opts);
      return client;
    },
    delete: (id: number) => remove(state, id),
    push: (...rows: RowInput<TMeta>[]) => {
      if (rows.length >= BULK_THRESHOLD) {
        return rows.reduce((ok, r) => {
          try {
            add(state, r.id, r.vector, r.meta ?? null, { upsert: false });
            return ok + 1;
          } catch {
            return ok;
          }
        }, 0);
      }
      for (const r of rows) add(state, r.id, r.vector, r.meta ?? null, { upsert: false });
      return rows.length;
    },
    upsert: (...rows: RowInput<TMeta>[]) => {
      if (rows.length >= BULK_THRESHOLD) {
        const res = upsertMany(state, rows, { upsert: true, mode: "best_effort" });
        return res.ok;
      }
      for (const r of rows) add(state, r.id, r.vector, r.meta ?? null, { upsert: true });
      return rows.length;
    },
    setMeta: (id: number, meta: TMeta | null) => coreSetMeta(state, id, meta),
    setVector: (id: number, vector: Float32Array, opts?: UpsertOptions) => {
      const rec = coreGet(state, id);
      const meta = rec ? rec.meta : null;
      try {
        add(state, id, vector, meta, opts);
        return true;
      } catch {
        return false;
      }
    },
    find: doFind,
    findMany: doFindMany,
  };
  return client;
}
// Note: legacy createDbOps and createDbFromState were removed in favor of createDatabaseFromState
