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

import type { FileIO } from "../storage/types";

export type ServerOptions = {
  port?: number;
  host?: string;
  strictPort?: boolean;
  cors?: CorsOptions;
  /** Optional WAL binding for server; explicit io+name required when provided */
  wal?: { io: FileIO; name: string };
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
import type { ClientOptions, StorageConfig } from "../client/indexing";

export type AppConfig = {
  name?: string;
  /** Concrete FileIOs required; no implicit resolution */
  storage?: StorageConfig;
  database?: VectorDBOptions;
  index?: ClientOptions & { name?: string };
  server?: ServerOptions;
};
