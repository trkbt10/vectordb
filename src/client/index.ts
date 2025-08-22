/**
 * @file Client entrypoint (composed by operation groups: db, index)
 */
import { createDatabaseFromState } from "./db";
import { createIndexOps, type ClientOptions, type StorageConfig, type IndexOps } from "./indexing";
import type { VectorDBOptions, VectorStoreState } from "../types";
import type { VectorDB } from "./types";
import { createState } from "../attr/state/create";
export type { VectorDB } from "./types";
export type { ClientOptions };

/**
 * Client facade with persistence helpers attached.
 * Why: keep in-memory DB surface small while composing persistence ops explicitly.
 */
export type ClientWithDatabase<TMeta> = VectorDB<TMeta> & { index: IndexOps<TMeta> };

/**
 * Connect options.
 * Why: prefer a single knex-like entry that always tries to open first; only creates when truly absent.
 */
export type ConnectOptions<TMeta> = {
  storage: StorageConfig;
  database?: VectorDBOptions;
  index?: ClientOptions & { name?: string };
  onMissing?: (ctx: {
    create: <U extends Record<string, unknown>>(opts: VectorDBOptions) => VectorStoreState<U>;
    index: IndexOps<TMeta>;
    name: string;
  }) => Promise<VectorStoreState<TMeta>> | VectorStoreState<TMeta>;
};

function isMissingStateError(e: unknown): boolean {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : String(e);
  // Reasons considered as "missing", not corruption: no manifest or no catalog to rebuild
  return msg.includes("manifest missing") || msg.includes("catalog missing");
}

/**
 * Connect to a vector DB snapshot.
 * Why: a single, predictable init path — attempt to open existing by name, else delegate creation.
 */
export async function connect<TMeta extends Record<string, unknown>>({
  storage,
  database: databaseOptions,
  index: indexOpts = {},
  onMissing,
}: ConnectOptions<TMeta>): Promise<ClientWithDatabase<TMeta>> {
  const name = (indexOpts as { name?: string })?.name ?? "db";
  const indexOperations = createIndexOps<TMeta>(storage, indexOpts);
  async function resolveState(): Promise<VectorStoreState<TMeta>> {
    try {
      return (await indexOperations.openState({ baseName: name })) as VectorStoreState<TMeta>;
    } catch (e) {
      if (!isMissingStateError(e)) {
        throw e;
      } // rethrow non-missing errors (e.g., corruption)
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
  const state = await resolveState();
  const database = createDatabaseFromState<TMeta>(state);
  const client = database as ClientWithDatabase<TMeta>;
  Object.defineProperty(client, "index", {
    value: indexOperations,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  return client;
}
