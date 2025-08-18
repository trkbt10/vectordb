/**
 * Distance/Similarity Metric.
 * - 'cosine': vectors are normalized internally, score in [-1,1]
 * - 'l2': score is negative squared distance (higher is closer)
 */
export type Metric = 'cosine' | 'l2'

/** Options for VectorLite construction. */
export interface VectorLiteInit {
  dim: number
  metric?: Metric // default: 'cosine'
  capacity?: number // initial capacity; doubles on growth
}

/** Controls add() behavior when id exists. */
export interface UpsertOptions { upsert?: boolean } // default: false

/** Search arguments. */
export interface SearchOptions<TMeta> {
  k?: number // default: 5
  filter?: (id: number, meta: TMeta | null) => boolean
}

/** Search result: id + score (+ meta). */
export interface SearchHit<TMeta> {
  id: number
  score: number // cosine: higher is closer; l2: negative distance (higher is closer)
  meta: TMeta | null
}

/** Public construction options. */
export interface VectorLiteOptions {
  dim: number
  metric?: Metric
  capacity?: number
  strategy?: 'bruteforce' | 'hnsw'
  hnsw?: HNSWParams
}

/** HNSW algorithm parameters. */
export interface HNSWParams {
  M?: number
  efConstruction?: number
  efSearch?: number
  levelMult?: number
  seed?: number
  allowReplaceDeleted?: boolean
}

// Public APIは関数ベースです。生成/復元は VectorLiteState を返し、
// 操作は関数（size/has/add/.../serialize）で行います。
