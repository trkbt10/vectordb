/**
 * @file Config types: single source for ServerOptions and AppConfig
 */

export type CorsOptions =
  | boolean
  | {
      origin?: string | string[] | RegExp | (string | RegExp)[] | true;
      allowMethods?: string[];
      allowHeaders?: string[];
      exposeHeaders?: string[];
      maxAge?: number;
      credentials?: boolean;
    };

import type { Clock } from "../coordination/clock";
import type { LockProvider } from "../coordination/lock";

export type ServerOptions = {
  port?: number;
  host?: string;
  strictPort?: boolean;
  cors?: CorsOptions;
  clock?: Clock;
  epsilonMs?: number;
  lock?: LockProvider;
  lockName?: string;
  lockTtlMs?: number;
  embeddings?: {
    provider?: "openai";
    apiKeyEnv?: string;
    apiKey?: string;
    model?: string;
    baseURL?: string;
    openAICompatRoute?: boolean;
  };
  resultConsistency?: boolean;
};

import type { VectorDBOptions } from "../types";
import type { FileIO } from "../storage/types";

export type DataIOResolver = FileIO | ((targetKey: string) => FileIO);
export type StorageConfig = { index: FileIO; data: DataIOResolver };

export type ClientOptions = {
  shards?: number;
  pgs?: number;
  replicas?: number;
  segmented?: boolean;
  segmentBytes?: number;
  includeAnn?: boolean;
};

export type AppConfig = {
  name?: string;
  storage?: StorageConfig;
  database?: VectorDBOptions;
  index?: ClientOptions;
  server?: ServerOptions;
};
