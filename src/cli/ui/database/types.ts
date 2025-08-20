/**
 * @file Type definitions for interactive database UI components
 * Why: keep UI contracts small and aligned with the current single-database client model.
 */
import type { ClientWithDatabase } from "../../../client/index";

export type Step =
  | { id: "form"; indexRoot: string; dataRoot: string }
  | { id: "loading"; indexRoot: string; dataRoot: string }
  | { id: "ready"; ctx: ClusterCtx }
  | { id: "error"; msg: string };

export type ClusterCtx = {
  name: string;
  client: ClientWithDatabase<unknown>;
};

