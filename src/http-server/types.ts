/**
 * @file HTTP server config types (Vite-like)
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

export type ServerOptions = {
  port?: number;
  host?: string;
  strictPort?: boolean;
  cors?: CorsOptions;
  wal?: { dir?: string };
  autoSave?: { ops?: number; intervalMs?: number };
  embeddings?: {
    provider?: "openai";
    /** If set, read API key from this env var name (default: OPENAI_API_KEY) */
    apiKeyEnv?: string;
    /** Explicit API key (not recommended to commit) */
    apiKey?: string;
    /** OpenAI embeddings model name */
    model?: string;
    /** Base URL for the OpenAI API */
    baseURL?: string;
    /** Mount OpenAI-compatible route at /v1/embeddings */
    openAICompatRoute?: boolean;
  };
};

import type { VectorDBOptions } from "../types";
import type { ClientOptions } from "../client/indexing";

export type NodeStorageConfig = { type: "node"; indexRoot: string; dataRoot: string };
export type MemoryStorageConfig = { type: "memory" };
export type StorageConfigInput = NodeStorageConfig | MemoryStorageConfig;

export type AppConfig = {
  name?: string;
  storage?: StorageConfigInput;
  database?: VectorDBOptions;
  index?: ClientOptions & { name?: string };
  server?: ServerOptions;
};
