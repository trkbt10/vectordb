/**
 * @file Public types for indexing manager and mapping
 */
import type { FileIO } from "../storage/types";

export type CrushTarget = {
  key: string; // logical storage key (e.g., 's3a', 'local-a')
  weight?: number;
  zone?: string;
};

export type CrushMap = {
  pgs: number; // number of placement groups
  replicas: number; // primary count (we use 1 for data write in this PoC)
  targets: CrushTarget[];
};

export type LocateResult = { pg: number; primaries: string[] };

export type ResolveDataIO = (targetKey: string) => FileIO;
export type ResolveIndexIO = () => FileIO;

/** Common context: provides index IO resolver. */
export type IndexIOCtx = { resolveIndexIO: ResolveIndexIO };
/** Common context: provides both data and index IO resolvers. */
export type DataIndexIOCtx = { resolveDataIO: ResolveDataIO; resolveIndexIO: ResolveIndexIO };

export type IndexingBaseOptions = {
  baseName: string;
  indexDir?: string; // default '.vlindex'
  crush: CrushMap;
  resolveDataIO: ResolveDataIO;
  resolveIndexIO: ResolveIndexIO;
};

export type SaveIndexingOptions = IndexingBaseOptions & {
  segmented?: boolean;
  segmentBytes?: number;
  includeAnn?: boolean;
  /** Control how HEAD is updated during save; default 'direct'. */
  headWrite?: "direct" | "none";
};

export type OpenIndexingOptions = IndexingBaseOptions & {
  rebuildIfNeeded?: boolean;
};

// Data pointer used by index entries
export type DataPointer = {
  segment: string;
  offset: number;
  length: number;
};

export type IndexEntry = {
  id: number;
  ptr: DataPointer;
};
