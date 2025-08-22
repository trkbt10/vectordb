/**
 * @file DB operations (client-side, in-memory)
 */
import type { VectorDB } from "./types";
import type { VectorStoreState, UpsertOptions, SearchHit, RowInput, VectorInput } from "../types";
import type { FindManyOptions, FindOptions } from "./types";
import type { IndexOps } from "./indexing";
import type { WalRuntime, WalRecord } from "../wal/index";
import type { AsyncLock } from "../util/async_lock";
import { createAsyncLock } from "../util/async_lock";
import { add, remove, search, size, has, getOne as coreGet, setMeta as coreSetMeta } from "../attr/ops/core";
import { searchWithExpr } from "../attr/search/with_expr";
import { upsertMany } from "../attr/ops/bulk";

const BULK_THRESHOLD = 8;

/**
 * Create a VectorDatabase facade from a given state.
 * Why: keep state shape decoupled from the method surface so we can evolve internals without breaking callers.
 */
export function createDatabaseFromState<TMeta>(
  state: VectorStoreState<TMeta>,
  index: IndexOps<TMeta>,
  opts?: { wal?: WalRuntime; lock?: AsyncLock; afterWrite?: (n: number) => Promise<void> | void },
): VectorDB<TMeta> {
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
  const base: Omit<VectorDB<TMeta>, "index"> = {
    state,
    get size() {
      return size(state);
    },
    has: async (id: number) => has(state, id),
    get: async (id: number) => coreGet(state, id),
    set: async (id: number, input: VectorInput<TMeta>, opts?: UpsertOptions) => {
      add(state, id, input.vector, input.meta ?? null, opts);
      return null;
    },
    delete: async (id: number) => remove(state, id),
    push: async (...rows: RowInput<TMeta>[]) => {
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
      for (const r of rows) {
        add(state, r.id, r.vector, r.meta ?? null, { upsert: false });
      }
      return rows.length;
    },
    upsert: async (...rows: RowInput<TMeta>[]) => {
      if (rows.length >= BULK_THRESHOLD) {
        const res = upsertMany(state, rows, { upsert: true, mode: "best_effort" });
        return res.ok;
      }
      for (const r of rows) {
        add(state, r.id, r.vector, r.meta ?? null, { upsert: true });
      }
      return rows.length;
    },
    setMeta: async (id: number, meta: TMeta | null) => coreSetMeta(state, id, meta),
    setVector: async (id: number, vector: Float32Array, opts?: UpsertOptions) => {
      const rec = coreGet(state, id);
      const meta = rec ? rec.meta : null;
      try {
        add(state, id, vector, meta, opts);
        return true;
      } catch {
        return false;
      }
    },
    find: async (q, opts) => doFind(q, opts),
    findMany: async (q, opts) => doFindMany(q, opts),
  };
  if (!opts?.wal) {
    return { ...base, index } as VectorDB<TMeta>;
  }
  const lock = opts.lock ?? createAsyncLock();
  const after = async (n: number) => {
    if (opts.afterWrite) {
      await opts.afterWrite(n);
    }
  };
  // Wrap writes to append WAL first
  const client: VectorDB<TMeta> = {
    ...base,
    index,
    delete: async (id: number) =>
      await lock.runExclusive(async () => {
        const rec: WalRecord = { type: "remove", id };
        await opts.wal!.append([rec]);
        const ok = await base.delete(id);
        await after(1);
        return ok;
      }),
    set: async (id: number, v: VectorInput<TMeta>, upsert?: UpsertOptions) =>
      await lock.runExclusive(async () => {
        const rec: WalRecord = { type: "upsert", id, vector: v.vector, meta: v.meta ?? null };
        await opts.wal!.append([rec]);
        await base.set(id, v, upsert);
        await after(1);
        return null;
      }),
    push: async (...rows: RowInput<TMeta>[]) =>
      await lock.runExclusive(async () => {
        const recs: WalRecord[] = rows.map((r) => ({ type: "upsert", id: r.id, vector: r.vector, meta: r.meta ?? null }));
        await opts.wal!.append(recs);
        const n = await base.push(...rows);
        await after(rows.length);
        return n;
      }),
    upsert: async (...rows: RowInput<TMeta>[]) =>
      await lock.runExclusive(async () => {
        const recs: WalRecord[] = rows.map((r) => ({ type: "upsert", id: r.id, vector: r.vector, meta: r.meta ?? null }));
        await opts.wal!.append(recs);
        const n = await base.upsert(...rows);
        await after(rows.length);
        return n;
      }),
    setMeta: async (id: number, meta: TMeta | null) =>
      await lock.runExclusive(async () => {
        const rec: WalRecord = { type: "setMeta", id, meta };
        await opts.wal!.append([rec]);
        const ok = await base.setMeta(id, meta);
        await after(1);
        return ok;
      }),
    setVector: async (id: number, vector: Float32Array, upsert?: UpsertOptions) =>
      await lock.runExclusive(async () => {
        const prev = await base.get(id);
        const meta = prev?.meta ?? null;
        const rec: WalRecord = { type: "upsert", id, vector, meta };
        await opts.wal!.append([rec]);
        const ok = await base.setVector(id, vector, upsert);
        await after(1);
        return ok;
      }),
  };
  return client;
}
