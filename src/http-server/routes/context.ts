/**
 * @file Route handler context shared across modules
 */
import type { ClientWithDatabase } from "../../client";
import type { AsyncLock } from "../lock";
import type { WalRuntime } from "../wal_runtime";

export type RouteContext = {
  client: ClientWithDatabase<Record<string, unknown>>;
  lock: AsyncLock;
  wal: WalRuntime;
  baseName: string;
  afterWrite: (nOps: number) => Promise<void> | void;
};
