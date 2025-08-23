/**
 * @file Open a database client from an executable config path (ESM JS)
 */
import type { VectorDB } from "../../../../../client/index";
import { openClientFromConfig } from "../../../../../config";

/** Open a client from a configuration file path (vectordb.config*). */
export async function openFromConfig(pathToConfig: string): Promise<VectorDB<Record<string, unknown>>> {
  return await openClientFromConfig(pathToConfig);
}
