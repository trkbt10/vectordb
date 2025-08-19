/**
 * @file Index builder for separated layout (writes index + manifest)
 */
import type { VectorLiteState } from "../types";
import type { IndexEntry } from "./types";
import { encodeIndexFile } from "./formats/index_file";
import type { ResolveIndexIO } from "./types";
import { encodeMetric, encodeStrategy } from "../constants/format";
import { isHnswVL, isIvfVL } from "../util/guards";
import { hnsw_serialize } from "../ann/hnsw";
import { ivf_serialize } from "../ann/ivf";
import { bf_serialize } from "../ann/bruteforce";

export type IndexBuildOptions = {
  baseName: string;
  resolveIndexIO: ResolveIndexIO;
  includeAnn?: boolean;
};

function annBytesFor<T>(vl: VectorLiteState<T>): Uint8Array {
  if (isHnswVL(vl)) return new Uint8Array(hnsw_serialize(vl.ann, vl.store));
  if (isIvfVL(vl)) return new Uint8Array(ivf_serialize(vl.ann, vl.store));
  return new Uint8Array(bf_serialize());
}

/** Build and write an index file using precomputed entries. */
export async function writeIndexFile<TMeta>(
  vl: VectorLiteState<TMeta>,
  entries: IndexEntry[],
  opts: IndexBuildOptions,
): Promise<void> {
  const includeAnn = opts.includeAnn !== false;
  const header = {
    metricCode: encodeMetric(vl.metric),
    dim: vl.dim,
    count: vl.store._count,
    strategyCode: encodeStrategy(vl.strategy),
    hasAnn: includeAnn,
  };
  const idxBytes = encodeIndexFile(header, entries, includeAnn ? annBytesFor(vl) : undefined);
  await opts.resolveIndexIO().atomicWrite(`${opts.baseName}.index`, idxBytes);
}

/** Write a placement manifest (segment name -> targetKey) for observability. */
export async function writePlacementManifest(
  baseName: string,
  manifest: { segments: { name: string; targetKey: string }[]; crush?: unknown },
  opts: { resolveIndexIO: ResolveIndexIO },
): Promise<void> {
  const m = { base: baseName, ...manifest };
  const bytes = new TextEncoder().encode(JSON.stringify(m));
  await opts.resolveIndexIO().atomicWrite(`${baseName}.manifest.json`, bytes);
}
