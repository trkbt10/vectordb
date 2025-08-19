/**
 * @file VectorLite wrappers for separated index/data persistence
 */

import { saveIndexing, openIndexing, rebuildIndexingFromData } from "../../indexing/runtime/manager";
import { SaveIndexingOptions, OpenIndexingOptions } from "../../indexing/types";
import { VectorStoreState } from "../../types";

/** Persist the current state to separated data segments + index (includes ANN when requested). */
export async function persistIndex<TMeta>(vl: VectorStoreState<TMeta>, opts: SaveIndexingOptions): Promise<void> {
  await saveIndexing(vl, opts);
}

/** Open a state from separated index/data using CRUSH mapping. */
export async function openFromIndex<TMeta = unknown>(opts: OpenIndexingOptions): Promise<VectorStoreState<TMeta>> {
  return await openIndexing<TMeta>(opts);
}

/** Rebuild a state from data-only using the index folder manifest. */
export async function rebuildFromData<TMeta = unknown>(opts: OpenIndexingOptions): Promise<VectorStoreState<TMeta>> {
  return await rebuildIndexingFromData<TMeta>(opts);
}
