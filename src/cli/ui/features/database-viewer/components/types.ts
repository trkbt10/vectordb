/**
 * @file Type definitions for interactive database UI components
 * Why: keep UI contracts small and aligned with the current single-database client model.
 */
import type { ClientWithDatabase } from "../../../../../client/index";

export type OpenInput =
  | { kind: "folder"; indexRoot: string; dataRoot: string; name: string }
  | { kind: "config"; path: string };

export type Step =
  | { id: "form" }
  | { id: "loading"; input: OpenInput }
  | { id: "ready"; ctx: ClusterCtx }
  | { id: "error"; msg: string };

export type ClusterCtx = {
  name: string;
  client: ClientWithDatabase<unknown>;
  selectedStrategy?: "bruteforce" | "hnsw" | "ivf";
  query?: { method: "auto" | "numeric" | "hash" | "openai"; name?: string };
};
