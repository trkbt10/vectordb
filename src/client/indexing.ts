/**
 * @file Index operations (persist + placement via CRUSH)
 */
import { saveIndexing, openIndexing, rebuildIndexingFromData } from "../indexing/runtime/manager";
import type { SaveIndexingOptions, IndexingBaseOptions, OpenIndexingOptions } from "../indexing/types";
import type { FileIO } from "../storage/types";
import type { ClientOptions, StorageConfig } from "../../config/types";
import type { VectorStoreState } from "../types";
import { planRebalance, applyRebalance, type MovePlan } from "../indexing/placement/rebalance";
import type { Clock } from "../coordination/clock";

export type DataIOResolver = FileIO | ((targetKey: string) => FileIO);
export type { StorageConfig } from "../../config/types";

/**
 * Compose persistence helpers for a client.
 * Why: centralize CRUSH placement and IO resolution so callers don't handle paths or target mapping directly.
 */
export function createIndexOps<TMeta>(
  persist: StorageConfig,
  defaults: ClientOptions = {},
  coordDefaults?: { clock?: Clock; epsilonMs?: number; useHeadForReads?: boolean },
) {
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
  return {
    async saveState(state: VectorStoreState<TMeta>, args: { baseName: string } & Partial<SaveIndexingOptions>) {
      const saveOpts = withSaveOptions(args) as SaveIndexingOptions & {
        coord?: { clock?: Clock; epsilonMs?: number; useHeadForReads?: boolean };
      };
      // Pass through coordination defaults for server-controlled clock/epsilon
      saveOpts.coord = { ...(saveOpts.coord ?? {}), ...(coordDefaults ?? {}) };
      await saveIndexing(state, saveOpts);
    },
    async openState(args: { baseName: string }): Promise<VectorStoreState<TMeta>> {
      const openOpts = withOpenOptions(args.baseName) as OpenIndexingOptions & {
        coord?: { clock?: Clock; epsilonMs?: number; useHeadForReads?: boolean };
      };
      openOpts.coord = { ...(openOpts.coord ?? {}), ...(coordDefaults ?? {}) };
      return await openIndexing<TMeta>(openOpts);
    },
    async rebuildState(args: { baseName: string }): Promise<VectorStoreState<TMeta>> {
      return await rebuildIndexingFromData<TMeta>(withOpenOptions(args.baseName));
    },
    async checkPlacement(baseName: string): Promise<{ ok: boolean; plan?: MovePlan[] }> {
      try {
        const u8 = await env.resolveIndexIO().read(`${baseName}.manifest.json`);
        const m = JSON.parse(new TextDecoder().decode(u8)) as { segments: { name: string; targetKey: string }[] };
        const plan = planRebalance(m, env.crush);
        return { ok: plan.length === 0, plan };
      } catch {
        return { ok: true };
      }
    },
    async ensurePlacement(
      baseName: string,
      opts?: { auto?: boolean; strict?: boolean; verify?: boolean; cleanup?: boolean },
    ): Promise<{ ok: boolean; applied: boolean; moves: number }> {
      const { ok, plan } = await this.checkPlacement(baseName);
      if (ok) {
        return { ok: true, applied: false, moves: 0 };
      }
      const moves = plan?.length ?? 0;
      if (opts?.auto) {
        await applyRebalance(baseName, plan!, {
          resolveDataIO: env.resolveDataIO,
          resolveIndexIO: env.resolveIndexIO,
          verify: opts?.verify,
          cleanup: opts?.cleanup,
        });
        return { ok: true, applied: true, moves };
      }
      if (opts?.strict) {
        throw new Error(`Placement mismatch detected; ${moves} move(s) recommended`);
      }
      console.warn(
        `[Cluster] Placement mismatch detected; ${moves} move(s) recommended. Call ensurePlacement(..., { auto: true }) to apply.`,
      );
      return { ok: false, applied: false, moves };
    },
  };
}

export type IndexOps<TMeta> = ReturnType<typeof createIndexOps<TMeta>>;
