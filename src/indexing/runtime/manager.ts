/**
 * @file Indexing runtime manager: orchestrates open/save/rebuild over index/data
 */
import type { VectorStoreState } from "../../types";
import { DataSegmentReader } from "../formats/data_segment";
import { decodeIndexFile } from "../formats/index_file";
import type { SaveIndexingOptions, OpenIndexingOptions } from "../types";
import { crushLocate } from "../placement/crush";
import { isHnswVL, isIvfVL } from "../../util/guards";
import { hnsw_deserialize } from "../../ann/hnsw";
import { ivf_deserialize } from "../../ann/ivf";
import { createState } from "../../attr/state/create";
import { normalizeVectorInPlace } from "../../util/math";
import { writeSegments } from "../placement/segmenter";
import { writeIndexFile, writePlacementManifest } from "../index_builder";
import { writeHead, readHead } from "../head_io";
import { computeCommitTs, commitWait } from "../../coordination/commit";
import { systemClock, type Clock } from "../../coordination/clock";
import { isReadableAt } from "../../coordination/head";
import { writeCatalog, readCatalog } from "../catalog";
import { encodeMetric, encodeStrategy, decodeMetric, decodeStrategy } from "../../constants/format";
import { buildHNSWFromStore, buildIVFFromStore } from "../../attr/ops/core";

/** Save state into separated data segments and an index in the index folder. */
export async function saveIndexing<TMeta>(vl: VectorStoreState<TMeta>, opts: SaveIndexingOptions): Promise<void> {
  // 1) Data segmentation (data-only IO)
  const { entries, manifest } = await writeSegments(vl, {
    baseName: opts.baseName,
    crush: opts.crush,
    resolveDataIO: opts.resolveDataIO,
    segmented: opts.segmented,
    segmentBytes: opts.segmentBytes,
  });
  // Coordination parameters (optional)
  const coord = (
    opts as unknown as {
      coord?: { lastCommittedTs?: number; epoch?: number; epsilonMs?: number; clock?: Clock };
    }
  ).coord;
  const clock = coord?.clock ?? systemClock;
  const epsilon = Math.max(0, coord?.epsilonMs ?? 0);
  const prepareTs = clock.now();

  // 2) Write catalog (index-only IO)
  await writeCatalog(
    opts.baseName,
    { dim: vl.dim, metricCode: encodeMetric(vl.metric), strategyCode: encodeStrategy(vl.strategy) },
    { resolveIndexIO: opts.resolveIndexIO },
  );
  // 3) Write placement manifest with epoch/commitTs metadata (before index build)
  const commitTs = computeCommitTs({
    prepareTs,
    lastCommittedTs: coord?.lastCommittedTs ?? 0,
    nowTs: clock.now(),
    delta: 1,
  });
  const epoch = coord?.epoch ?? 0;
  await writePlacementManifest(
    opts.baseName,
    { segments: manifest.segments, crush: opts.crush, epoch, commitTs },
    { resolveIndexIO: opts.resolveIndexIO },
  );
  // 4) Build index file (index-only IO)
  await writeIndexFile(vl, entries, {
    baseName: opts.baseName,
    resolveIndexIO: opts.resolveIndexIO,
    includeAnn: opts.includeAnn,
  });
  // 5) Update HEAD pointer (no CAS here; assume single-writer lock outside)
  await writeHead(
    opts.baseName,
    { manifest: `${opts.baseName}.manifest.json`, epoch, commitTs },
    { resolveIndexIO: opts.resolveIndexIO },
  );
  // 6) Commit-wait for external consistency if epsilon > 0
  if (epsilon > 0) {
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    await commitWait(commitTs, epsilon, () => clock.now(), sleep);
  }
}

/** Open a separated index/data layout using CRUSH to resolve segment locations. */
export async function openIndexing<TMeta = unknown>(opts: OpenIndexingOptions): Promise<VectorStoreState<TMeta>> {
  const base = opts.baseName;
  // Coordination for bounded staleness on read
  const coord = (opts as unknown as { coord?: { epsilonMs?: number; clock?: Clock; useHeadForReads?: boolean } }).coord;
  const clock = coord?.clock ?? systemClock;
  const epsilon = Math.max(0, coord?.epsilonMs ?? 0);
  const readTs = clock.now() - epsilon;
  const idxU8 = await (async () => {
    try {
      return await opts.resolveIndexIO().read(`${base}.index`);
    } catch {
      return null;
    }
  })();
  if (!idxU8) {
    return await rebuildIndexingFromData<TMeta>(opts);
  }

  const { header, entries, ann } = decodeIndexFile(idxU8);
  const vl0 = createState<TMeta>({
    dim: header.dim,
    metric: decodeMetric(header.metricCode),
    strategy: decodeStrategy(header.strategyCode),
    capacity: header.count,
  });
  const finalize = (current: typeof vl0) => current;

  // resolve per-segment IO via CRUSH(id)
  const segReaders = new Map<string, DataSegmentReader>();
  const segTarget = new Map<string, string>();
  // Prefer manifest mapping selected via HEAD (bounded staleness), else default manifest
  const manifest = await (async () => {
    try {
      const head =
        coord?.useHeadForReads === false ? null : await readHead(base, { resolveIndexIO: opts.resolveIndexIO });
      const manifestPath = head && isReadableAt(head, readTs) ? head.manifest : `${base}.manifest.json`;
      const m = await opts.resolveIndexIO().read(manifestPath);
      return JSON.parse(new TextDecoder().decode(m)) as { segments: { name: string; targetKey: string }[] };
    } catch {
      return null;
    }
  })();
  if (manifest) {
    for (const s of manifest.segments) {
      segTarget.set(s.name, s.targetKey);
    }
  }

  for (const e of entries) {
    const t =
      segTarget.get(e.ptr.segment) ??
      (() => {
        const { primaries } = crushLocate(e.id, opts.crush);
        const key = primaries[0] ?? "local";
        segTarget.set(e.ptr.segment, key);
        return key;
      })();
    const seg =
      segReaders.get(e.ptr.segment) ??
      (await (async () => {
        const io = opts.resolveDataIO(t);
        const r = await DataSegmentReader.fromFile(io, `${e.ptr.segment}.data`, e.ptr.segment);
        segReaders.set(e.ptr.segment, r);
        return r;
      })());
    const row = seg.readAt(e.ptr.offset, e.ptr.length);
    const i = vl0.store._count;
    vl0.store.ids[i] = e.id >>> 0;
    const vec = row.vector.slice();
    // For cosine metric, vectors must be L2-normalized to ensure correct similarity scores
    // and comparable search behavior with in-memory operations.
    if (vl0.metric === "cosine") {
      normalizeVectorInPlace(vec);
    }
    vl0.store.data.set(vec, i * vl0.dim);
    vl0.store.metas[i] = (row.meta as TMeta | null) ?? null;
    vl0.store.pos.set(e.id >>> 0, i);
    vl0.store._count++;
  }
  if (ann && ann.length > 0) {
    if (isHnswVL(vl0)) {
      hnsw_deserialize(vl0.ann, vl0.store, ann.slice().buffer as ArrayBuffer);
      return finalize(vl0);
    }
    if (isIvfVL(vl0)) {
      ivf_deserialize(vl0.ann, vl0.store, ann.slice().buffer as ArrayBuffer);
      return finalize(vl0);
    }
    return finalize(vl0);
  }
  if (opts.rebuildIfNeeded !== false) {
    // rebuild ANN from store if requested
    if (isHnswVL(vl0)) {
      return finalize(buildHNSWFromStore(vl0));
    }

    if (isIvfVL(vl0)) {
      return finalize(buildIVFFromStore(vl0));
    }
  }
  return finalize(vl0);
}

/** Rebuild a state from data segments using the index folder manifest. */
export async function rebuildIndexingFromData<TMeta = unknown>(
  opts: OpenIndexingOptions,
): Promise<VectorStoreState<TMeta>> {
  const base = opts.baseName;
  // use manifest (if exists) to observe segments and destinations; fallback to CRUSH scan by probing likely pgs
  const manifest = await (async () => {
    try {
      const m = await opts.resolveIndexIO().read(`${base}.manifest.json`);
      return JSON.parse(new TextDecoder().decode(m)) as { segments: { name: string; targetKey: string }[] };
    } catch {
      return null;
    }
  })();
  if (!manifest) {
    throw new Error("manifest missing; control plane must supply segment locations");
  }

  // Load catalog (required to avoid guessing)
  const cat = await readCatalog(base, { resolveIndexIO: opts.resolveIndexIO });
  if (!cat) {
    throw new Error("catalog missing; cannot rebuild without metric/strategy/dim");
  }
  const vl = createState<TMeta>({
    dim: cat.dim,
    metric: decodeMetric(cat.metricCode),
    strategy: decodeStrategy(cat.strategyCode),
  });
  // load all
  for (const s of manifest.segments) {
    const reader = await DataSegmentReader.fromFile(opts.resolveDataIO(s.targetKey), `${s.name}.data`, s.name);
    for (const it of reader.rows()) {
      const { id, vector, meta } = it.row;
      if (vl.store._count >= vl.store._capacity) {
        // grow
        const extra = Math.max(1, vl.store._capacity);
        const ids2 = new Uint32Array(vl.store._capacity + extra);
        ids2.set(vl.store.ids);
        const data2 = new Float32Array((vl.store._capacity + extra) * vl.dim);
        data2.set(vl.store.data);
        const metas2 = new Array(vl.store._capacity + extra).fill(null) as (TMeta | null)[];
        for (let j = 0; j < vl.store._count; j++) {
          metas2[j] = vl.store.metas[j];
        }
        vl.store.ids = ids2;
        vl.store.data = data2;
        vl.store.metas = metas2;
        vl.store._capacity = vl.store._capacity + extra;
      }
      const idx = vl.store._count;
      vl.store.ids[idx] = id >>> 0;
      const vec = vector.slice();
      // For cosine metric, vectors must be L2-normalized to maintain score semantics
      // consistent with add()/search() behavior in memory.
      if (vl.metric === "cosine") {
        normalizeVectorInPlace(vec);
      }
      vl.store.data.set(vec, idx * vl.dim);
      vl.store.metas[idx] = meta as TMeta | null;
      vl.store.pos.set(id >>> 0, idx);
      vl.store._count = idx + 1;
    }
  }
  return vl;
}
