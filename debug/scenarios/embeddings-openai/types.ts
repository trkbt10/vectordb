/**
 * @file Type definitions for OpenAI embeddings scenario
 */

import type { FilterExpr } from "../../../src/attr/filter/expr";
import type { Doc } from "../../../spec/__mocks__/DOCS";

export type Meta = {
  title: string;
  category: string;
  tags: string[];
  author: string;
  year: number;
};

export type Hit = {
  id: number;
  title: string;
  score: number;
};

export type EvalItem = {
  q: string;
  recall: string;
  recallNum: number;
  ivfRecall: string;
  ivfRecallNum: number;
  bfIds: number[];
  hnswIds: number[];
  ivfIds: number[];
  missing: number[];
  extra: number[];
};

export type SearchQuery = {
  q: string;
  desc: string;
  expr?: FilterExpr;
};

export type AppStatus =
  | "init"
  | "embedding"
  | "indexing"
  | "querying"
  | "saving"
  | "reloading"
  | "done"
  | "error";

export type AppStrategy = "bruteforce" | "hnsw" | "ivf";
