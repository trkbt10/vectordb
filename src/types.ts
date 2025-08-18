/**
 * Distance/Similarity Metric.
 * - 'cosine': vectors are normalized internally, score in [-1,1]
 * - 'l2': score is negative squared distance (higher is closer)
 */
export type Metric = "cosine" | "l2";

/** Options for VectorLite construction. */
export type VectorLiteInit = {
  dim: number;
  metric?: Metric; // default: 'cosine'
  capacity?: number; // initial capacity; doubles on growth
}

/** Controls add() behavior when id exists. */
export type UpsertOptions = {
  upsert?: boolean;
} // default: false

/** Search arguments. */
export type SearchOptions<TMeta> = {
  k?: number; // default: 5
  filter?: (id: number, meta: TMeta | null) => boolean;
}

/** Search result: id + score (+ meta). */
export type SearchHit<TMeta> = {
  id: number;
  score: number; // cosine: higher is closer; l2: negative distance (higher is closer)
  meta: TMeta | null;
}

/** Public construction options. */
export type VectorLiteOptions = {
  dim: number;
  metric?: Metric;
  capacity?: number;
  strategy?: "bruteforce" | "hnsw";
  hnsw?: HNSWParams;
}

/** HNSW algorithm parameters. */
export type HNSWParams = {
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  levelMult?: number;
  seed?: number;
  allowReplaceDeleted?: boolean;
}
