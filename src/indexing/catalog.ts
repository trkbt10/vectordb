/**
 * @file Catalog for separated index/data: persists global params for rebuilds
 */
import type { ResolveIndexIO } from "./types";

export type Catalog = {
  version: number;
  dim: number;
  metricCode: number;
  strategyCode: number;
};

const CATALOG_VERSION = 1;

/** Write catalog.json with global parameters for rebuilds. */
export async function writeCatalog(
  baseName: string,
  data: { dim: number; metricCode: number; strategyCode: number },
  opts: { resolveIndexIO: ResolveIndexIO },
): Promise<void> {
  const cat: Catalog = {
    version: CATALOG_VERSION,
    dim: data.dim,
    metricCode: data.metricCode,
    strategyCode: data.strategyCode,
  };
  const u8 = new TextEncoder().encode(JSON.stringify(cat));
  await opts.resolveIndexIO().atomicWrite(`${baseName}.catalog.json`, u8);
}

/** Read catalog.json if present; returns null when absent/invalid. */
export async function readCatalog(baseName: string, opts: { resolveIndexIO: ResolveIndexIO }): Promise<Catalog | null> {
  try {
    const u8 = await opts.resolveIndexIO().read(`${baseName}.catalog.json`);
    const cat = JSON.parse(new TextDecoder().decode(u8)) as Catalog;
    if (!cat || typeof cat.version !== "number") {
      return null;
    }
    return cat;
  } catch {
    return null;
  }
}
