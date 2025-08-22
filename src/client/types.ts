/**
 * @file VectorDB public facade types
 */
import type { SearchHit, UpsertOptions, VectorRecord, VectorStoreState, VectorInput, RowInput } from "../types";
import type { IndexOps } from "./indexing";
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
  index: IndexOps<TMeta>;
  has(id: number): Promise<boolean>;
  get(id: number): Promise<VectorRecord<TMeta> | null>;
  set(id: number, v: VectorInput<TMeta>, opts?: UpsertOptions): Promise<null>;
  delete(id: number): Promise<boolean>;
  push(...rows: RowInput<TMeta>[]): Promise<number>;
  upsert(...rows: RowInput<TMeta>[]): Promise<number>;
  setMeta(id: number, meta: TMeta | null): Promise<boolean>;
  setVector(id: number, vector: Float32Array, opts?: UpsertOptions): Promise<boolean>;
  find(q: Float32Array, opts?: FindOptions<TMeta>): Promise<SearchHit<TMeta> | null>;
  findMany(q: Float32Array, opts?: FindManyOptions<TMeta>): Promise<SearchHit<TMeta>[]>;
};
