/**
 * @file Types for Crush CLI visualization
 */

import type { CrushMap } from "../../src/indexing/types";

export type CrushTemplate = {
  name: string;
  description: string;
  map: CrushMap;
};

export type ShardAccess = {
  id: number;
  pg: number;
  shard: string;
  timestamp: number;
};

export type ShardStats = {
  [shard: string]: {
    count: number;
    percentage: number;
    lastAccess?: number;
  };
};

export type AppState = {
  selectedTemplate: CrushTemplate | null;
  isRunning: boolean;
  accesses: ShardAccess[];
  stats: ShardStats;
  totalAccesses: number;
};
