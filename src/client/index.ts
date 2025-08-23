/**
 * @file Client entrypoint (composed by operation groups: db, index)
 */
import { createDatabaseFromState } from "./db";
import { createIndexOps, type StorageConfig, type IndexOps } from "./indexing";
import type { ClientOptions } from "./indexing";
import type { VectorDB } from "./types";
import type { VectorStoreState } from "../types";
// import type { WalRuntime } from "../wal/index";
import type { AsyncLock } from "../util/async_lock";
import { createAsyncLock } from "../util/async_lock";
import type { FileIO } from "../storage/types";
import type { DatabaseOptions } from "../types";
import { createState } from "../attr/state/create";
import { createWalRuntime } from "../wal/index";
import { createAutoSaveAfterWrite } from "./autosave";
export type { VectorDB } from "./types";
export type { ClientOptions };
import type { Clock } from "../coordination/clock";

/**
 * Connect options.
 * Why: prefer a single knex-like entry that always tries to open first; only creates when truly absent.
 */
export type ConnectOptions<TMeta> = {
  /** Only state policy should remain here */
  onMissing?: (ctx: {
    create: <U extends Record<string, unknown>>(opts: DatabaseOptions) => VectorStoreState<U>;
    index: IndexOps<TMeta>;
    name: string;
  }) => Promise<VectorStoreState<TMeta>> | VectorStoreState<TMeta>;
};

export type ConnectDeps = {
  storage: StorageConfig;
  database?: DatabaseOptions;
  index?: ClientOptions & { name?: string };
  wal?: { io: FileIO; name: string };
  lock?: AsyncLock;
  autoSave?: { ops?: number; intervalMs?: number };
  /** Server-injected defaults for clock/epsilon used by open/save */
  coordDefaultsForIndexing?: { clock?: Clock; epsilonMs?: number };
};

function isMissingStateError(e: unknown): boolean {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : String(e);
  // Reasons considered as "missing", not corruption: no manifest or no catalog to rebuild
  return msg.includes("manifest missing") || msg.includes("catalog missing");
}

/**
 * Resolve a VectorStoreState from storage and options, creating or delegating when missing.
 */
async function resolveState<TMeta>(
  name: string,
  indexOperations: IndexOps<TMeta>,
  databaseOptions: DatabaseOptions | undefined,
  onMissing?: (ctx: {
    create: <U extends Record<string, unknown>>(opts: DatabaseOptions) => VectorStoreState<U>;
    index: IndexOps<TMeta>;
    name: string;
  }) => Promise<VectorStoreState<TMeta>> | VectorStoreState<TMeta>,
): Promise<VectorStoreState<TMeta>> {
  try {
    return (await indexOperations.openState({ baseName: name })) as VectorStoreState<TMeta>;
  } catch (e) {
    if (!isMissingStateError(e)) {
      throw e;
    }
    if (onMissing) {
      return (await onMissing({ create: createState, index: indexOperations, name })) as VectorStoreState<TMeta>;
    }
    if (databaseOptions) {
      const s = createState<TMeta>(databaseOptions);
      await indexOperations.saveState(s, { baseName: name });
      return s;
    }
    throw new Error("State not found; pass database or onMissing to create.");
  }
}

/**
 * Connect to a vector DB snapshot.
 * Why: a single, predictable init path — attempt to open existing by name, else delegate creation.
 */
export async function connect<TMeta extends Record<string, unknown>>(
  deps: ConnectDeps,
  opts?: ConnectOptions<TMeta>,
): Promise<VectorDB<TMeta>> {
  const { storage, database: databaseOptions, index: indexOpts = {}, wal, autoSave, lock } = deps;
  const name = (indexOpts as { name?: string })?.name ?? "db";
  const indexOperations = createIndexOps<TMeta>(storage, indexOpts, deps.coordDefaultsForIndexing);
  const state = await resolveState<TMeta>(name, indexOperations, databaseOptions, opts?.onMissing);
  const walIO = wal?.io ?? storage.index;
  const walName = wal?.name ?? `${name}.wal`;
  const rt = createWalRuntime(walIO, walName);
  const lk = lock ?? createAsyncLock();
  // Autosave policy: encapsulated in dedicated helper
  const { afterWrite: autoAfterWrite } = createAutoSaveAfterWrite(indexOperations, state, rt, lk, name, autoSave);
  const wrapped = createDatabaseFromState<TMeta>(state, indexOperations, {
    wal: rt,
    lock: lk,
    afterWrite: autoAfterWrite,
  });
  void rt.replayInto(wrapped.state);
  return wrapped;
}
