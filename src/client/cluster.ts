/**
 * @file Cluster helpers (persistence + placement)
 *
 * Subject: Cluster constructor and its helpers
 * - createCluster: binds IO adapters and exposes db/index helpers
 *
 * Master/Subordinate hierarchy:
 * - Cluster (master): orchestrates persistence and placement (CRUSH)
 * - State/Client (subordinate): created via cluster.db.* and persisted via cluster.index.*
 */
import { saveIndexing, openIndexing, rebuildIndexingFromData } from "../indexing/runtime/manager";
import { planRebalance, applyRebalance } from "../indexing/placement/rebalance";
import type { SaveIndexingOptions, IndexingBaseOptions, OpenIndexingOptions } from "../indexing/types";
import type { FileIO } from "../persist/types";
import type { VectorDBOptions, VectorStoreState } from "../types";
import { create, fromState } from "./create";
import type { VectorDB } from "./types";

export type ClusterOptions = Partial<Pick<SaveIndexingOptions, "segmented" | "segmentBytes" | "includeAnn">> & {
  shards?: number;
  pgs?: number;
  replicas?: number;
};

/**
 * Create a cluster bound to the given IO adapters.
 * Provides db helpers (create/from) and index helpers (save/open/rebuild/rebalance).
 */
export function createCluster<
  TMeta extends {
    [key: string]: unknown;
  },
>(persist: { index: FileIO; data: FileIO | ((targetKey: string) => FileIO) }, defaults: ClusterOptions = {}) {
  const shards = Math.max(1, defaults.shards ?? 1);
  const pgs = Math.max(1, defaults.pgs ?? 64);
  const replicas = Math.max(1, defaults.replicas ?? 1);
  const targets = Array.from({ length: shards }, (_, i) => ({ key: String(i) }));
  const env = {
    crush: { pgs, replicas, targets },
    resolveIndexIO: () => persist.index,
    resolveDataIO: (key: string) => (typeof persist.data === "function" ? persist.data(key) : persist.data),
  };
  const mergedSave = (over?: Partial<Pick<SaveIndexingOptions, "segmented" | "segmentBytes" | "includeAnn">>) => ({
    segmented: over?.segmented ?? defaults.segmented ?? true,
    segmentBytes: over?.segmentBytes ?? defaults.segmentBytes ?? 1 << 20,
    includeAnn: over?.includeAnn ?? defaults.includeAnn ?? false,
  });
  const withIndexingBase = (baseName: string): IndexingBaseOptions => ({
    baseName,
    crush: env.crush,
    resolveDataIO: env.resolveDataIO,
    resolveIndexIO: env.resolveIndexIO,
  });
  const withSaveOptions = (args: { baseName: string } & Partial<SaveIndexingOptions>): SaveIndexingOptions => ({
    ...withIndexingBase(args.baseName),
    ...mergedSave(args),
  });
  const withOpenOptions = (baseName: string, over?: Partial<OpenIndexingOptions>): OpenIndexingOptions => ({
    ...withIndexingBase(baseName),
    ...(over ?? {}),
  });
  function isClient(x: VectorDB<TMeta> | VectorStoreState<TMeta>): x is VectorDB<TMeta> {
    return typeof (x as VectorDB<TMeta>).state !== "undefined";
  }
  return {
    db: {
      create(opts: VectorDBOptions, seed?: Array<{ id: number; vector: Float32Array; meta: TMeta | null }>): VectorDB<TMeta> {
        return create<TMeta>(opts, seed);
      },
      from(state: VectorStoreState<TMeta>): VectorDB<TMeta> {
        return fromState<TMeta>(state);
      },
    },
    index: {
      async save(clientOrState: VectorDB<TMeta> | VectorStoreState<TMeta>, args: { baseName: string } & Partial<SaveIndexingOptions>) {
        const state = isClient(clientOrState)
          ? (clientOrState as VectorDB<TMeta>).state
          : (clientOrState as VectorStoreState<TMeta>);
        const saveOpts = withSaveOptions(args);
        await saveIndexing(state, saveOpts);
      },
      async openState(args: { baseName: string }): Promise<VectorStoreState<TMeta>> {
        return await openIndexing<TMeta>(withOpenOptions(args.baseName));
      },
      async rebuildState(args: { baseName: string }): Promise<VectorStoreState<TMeta>> {
        return await rebuildIndexingFromData<TMeta>(withOpenOptions(args.baseName));
      },
      planRebalance: (manifest: { segments: { name: string; targetKey: string }[] }) =>
        planRebalance(manifest, env.crush),
      applyRebalance: async (
        baseName: string,
        plan: Parameters<typeof applyRebalance>[1],
        opts?: { verify?: boolean; cleanup?: boolean },
      ) =>
        applyRebalance(baseName, plan, {
          resolveDataIO: env.resolveDataIO,
          resolveIndexIO: env.resolveIndexIO,
          verify: opts?.verify,
          cleanup: opts?.cleanup,
        }),
    },
  };
}
