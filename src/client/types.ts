/**
 * @file VectorDB public facade types
 */
import type { SearchHit, UpsertOptions, VectorRecord, VectorStoreState, VectorInput, RowInput } from "../types";
import type { FilterExpr } from "../attr/filter/expr";
import type { SearchWithExprOptions } from "../attr/search/with_expr";

// New unified options
export type FindOptions<TMeta> = {
  filter?: (id: number, meta: TMeta | null) => boolean;
  expr?: FilterExpr;
  exprOpts?: Omit<SearchWithExprOptions, "k">;
};
export type FindManyOptions<TMeta> = FindOptions<TMeta> & { k?: number };

export type VectorDB<TMeta = unknown> = {
  state: VectorStoreState<TMeta>;
  readonly size: number;
  has(id: number): boolean;
  get(id: number): VectorRecord<TMeta> | null;
  set(id: number, v: VectorInput<TMeta>, opts?: UpsertOptions): VectorDB<TMeta>;
  delete(id: number): boolean;
  push(...rows: RowInput<TMeta>[]): number;
  upsert(...rows: RowInput<TMeta>[]): number;
  setMeta(id: number, meta: TMeta | null): boolean;
  setVector(id: number, vector: Float32Array, opts?: UpsertOptions): boolean;
  find(q: Float32Array, opts?: FindOptions<TMeta>): SearchHit<TMeta> | null;
  findMany(q: Float32Array, opts?: FindManyOptions<TMeta>): SearchHit<TMeta>[];
};
