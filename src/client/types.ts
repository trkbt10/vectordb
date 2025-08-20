/**
 * @file VectorDB public facade types
 */
import type { SearchHit, SearchOptions, UpsertOptions, VectorRecord, VectorStoreState } from "../types";

export type VectorDB<TMeta = unknown> = {
  state: VectorStoreState<TMeta>;
  readonly size: number;
  has(id: number): boolean;
  get(id: number): VectorRecord<TMeta> | null;
  set(
    id: number,
    v: Float32Array | { vector: Float32Array; meta?: TMeta | null },
    meta?: TMeta | null,
    opts?: UpsertOptions,
  ): VectorDB<TMeta>;
  delete(id: number): boolean;
  push(
    rowOrRows:
      | { id: number; vector: Float32Array; meta?: TMeta | null }
      | Array<{ id: number; vector: Float32Array; meta?: TMeta | null }>,
    opts?: UpsertOptions,
  ): number;
  search(q: Float32Array, opts?: SearchOptions<TMeta>): SearchHit<TMeta>[];
  find(q: Float32Array, opts?: SearchOptions<TMeta>): SearchHit<TMeta> | null;
  findK(q: Float32Array, k: number, opts?: Omit<SearchOptions<TMeta>, "k">): SearchHit<TMeta>[];
};
