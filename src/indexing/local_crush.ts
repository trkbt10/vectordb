/**
 * @file Helpers for local CRUSH-like environment with directory sharding
 */
import type { CrushMap, ResolveDataIO, ResolveIndexIO } from "./types";
import { createPrefixedNodeFileIO } from "../persist/node";
import { join as joinPath } from "node:path";

export type LocalCrushEnv = {
  crush: CrushMap;
  resolveDataIO: ResolveDataIO;
  resolveIndexIO: ResolveIndexIO;
};

/**
 * Create a simple local CRUSH environment that splits data across subdirectories.
 * - baseDir: root folder
 * - shards: number of target subdirectories under baseDir/data/<shard>
 * - pgs: number of placement groups
 * - replicas: replica count (default 1)
 */
export function createLocalCrushEnv(baseDir: string, shards = 4, pgs = 64, replicas = 1): LocalCrushEnv {
  const targets = Array.from({ length: Math.max(1, shards | 0) }, (_, i) => ({ key: String(i) }));
  const crush: CrushMap = { pgs: Math.max(1, pgs | 0), replicas: Math.max(1, replicas | 0), targets };
  const resolveDataIO: ResolveDataIO = (key: string) => createPrefixedNodeFileIO(joinPath(baseDir, "data", key));
  const resolveIndexIO: ResolveIndexIO = () => createPrefixedNodeFileIO(joinPath(baseDir, ".vlindex"));
  return { crush, resolveDataIO, resolveIndexIO };
}
