/**
 * @file HNSW (Hierarchical Navigable Small World) graph-based ANN implementation
 *
 * This module implements the HNSW algorithm for approximate nearest neighbor search,
 * providing high-performance similarity search with logarithmic complexity. Features:
 * - Multi-layer graph structure with hierarchical connections
 * - Configurable parameters (M, efConstruction, efSearch) for performance tuning
 * - Support for dynamic insertion and soft deletion (tombstones)
 * - Advanced search controls (filtering modes, bridge budgets, adaptive exploration)
 * - Efficient binary serialization for persistence
 *
 * HNSW is the recommended strategy for large-scale vector databases where exact
 * search becomes impractical. It trades a small amount of accuracy for massive
 * speed improvements while maintaining high recall rates.
 */

import { CoreStore, getByIndex, getIndex } from "../core/store";
import { HNSWParams, Metric, SearchHit } from "../types";
import { createReader, createWriter } from "../util/bin";
import { getScoreAtFn } from "../util/similarity";
import { pushSortedDesc } from "../util/topk";
import { MaxHeap } from "../util/heap";

function createRng(seed = 42) {
  let state = seed >>> 0 || 1;
  return () => {
    let x = state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state = x >>> 0;
    return (state & 0xffffffff) / 0x100000000;
  };
}

export type HNSWState = {
  type: "hnsw";
  metric: Metric;
  M: number;
  efConstruction: number;
  efSearch: number;
  levelMult: number;
  allowReplaceDeleted: boolean;
  enterPoint: number;
  maxLevel: number;
  levelArr: number[];
  tombstone: Uint8Array;
  links: Array<Array<number[]>>;
  rng: () => number;
};

/**
 *
 */
export function createHNSWState(params: HNSWParams, metric: Metric, capacity: number): HNSWState {
  const M = params.M ?? 16;
  return {
    type: "hnsw",
    metric,
    M,
    efConstruction: params.efConstruction ?? 200,
    efSearch: params.efSearch ?? 50,
    levelMult: params.levelMult ?? 1 / Math.log(M),
    allowReplaceDeleted: !!params.allowReplaceDeleted,
    enterPoint: -1,
    maxLevel: -1,
    levelArr: new Array(capacity).fill(0),
    tombstone: new Uint8Array(capacity),
    links: [],
    rng: createRng(params.seed ?? 42),
  };
}

/**
 *
 */
export function hnsw_ensureCapacity(h: HNSWState, capacity: number) {
  if (h.levelArr.length >= capacity && h.tombstone.length >= capacity) return;
  if (h.levelArr.length < capacity) h.levelArr = h.levelArr.concat(new Array(capacity - h.levelArr.length).fill(0));
  if (h.tombstone.length < capacity) {
    const t = new Uint8Array(capacity);
    t.set(h.tombstone);
    h.tombstone = t;
  }
}

function hnsw_score<TMeta>(h: HNSWState, store: CoreStore<TMeta>, idx: number, q: Float32Array): number {
  const dim = store.dim;
  const base = idx * dim;
  const scoreAt = getScoreAtFn(h.metric);
  return scoreAt(store.data, base, q, dim);
}

function hnsw_sampleLevel(h: HNSWState): number {
  const u = Math.max(Number.EPSILON, h.rng());
  return Math.floor(-Math.log(u) * h.levelMult);
}

function ensureLevels(h: HNSWState, L: number) {
  while (h.links.length <= L) h.links.push([]);
}

function greedyDescent<TMeta>(
  h: HNSWState,
  store: CoreStore<TMeta>,
  ep: number,
  target: Float32Array,
  fromLevel: number,
): number {
  let cur = ep;
  for (let l = fromLevel; l > 0; l--) {
    let improved = true;
    while (improved) {
      improved = false;
      const neigh = h.links[l][cur] || [];
      let bestIdx = cur;
      let bestScore = hnsw_score(h, store, cur, target);
      for (const nb of neigh) {
        if (h.tombstone[nb]) continue;
        const sc = hnsw_score(h, store, nb, target);
        if (sc > bestScore) {
          bestScore = sc;
          bestIdx = nb;
          improved = true;
        }
      }
      cur = bestIdx;
    }
  }
  return cur;
}

type Scored = { idx: number; s: number };

export type HNSWSearchControl = {
  mode?: "soft" | "hard";
  mask?: Set<number>;
  maskIdx?: Uint8Array;
  bridgeBudget?: number;
  seeds?: "auto" | number;
  seedStrategy?: "random" | "topFreq";
  adaptiveEf?: { base: number; min: number; max: number };
  earlyStop?: { margin?: number };
};

/**
 *
 */
export function computeNumSeeds(maskSize: number, seeds: "auto" | number): number {
  if (seeds === "auto") return Math.max(1, Math.min(8, Math.floor(Math.sqrt(Math.max(0, maskSize)))));
  const n = Math.floor(seeds);
  return Math.max(1, Math.min(32, n));
}

type SearchLayerArgs<TMeta> = {
  h: HNSWState;
  store: CoreStore<TMeta>;
  entry: number;
  target: Float32Array;
  level: number;
  ef: number;
  options?: HNSWSearchControl;
};

function hnsw_searchLayer<TMeta>(args: SearchLayerArgs<TMeta>): Scored[] {
  const { h, store, entry, target, level, ef, options } = args;
  const visited = new Uint8Array(store._count);
  const heap = new MaxHeap<Scored>();
  const results: Scored[] = [];
  const entryScore = hnsw_score(h, store, entry, target);
  heap.push({ idx: entry, s: entryScore });
  results.push({ idx: entry, s: entryScore });
  visited[entry] = 1;
  const mode = options?.mode;
  const mask = options?.mask;
  const maskIdx = options?.maskIdx;
  let bridges = options?.bridgeBudget ?? 0;

  while (heap.length) {
    const cur = heap.pop() as Scored;
    const worst = results[results.length - 1]?.s ?? Number.NEGATIVE_INFINITY;
    const margin = options?.earlyStop?.margin ?? 0;
    if (results.length >= ef && cur.s <= worst + margin) {
      break;
    }
    const neigh = h.links[level] && h.links[level][cur.idx] ? h.links[level][cur.idx] : [];
    for (const nb of neigh) {
      if (visited[nb]) {
        continue;
      }
      visited[nb] = 1;
      if (h.tombstone[nb]) {
        continue;
      }
      if ((mask || maskIdx) && mode) {
        const allowed = maskIdx ? !!(maskIdx[nb] === 1) : mask!.has(store.ids[nb] as number);
        if (mode === "hard" && !allowed) {
          continue;
        }
        if (mode === "soft" && !allowed) {
          if (bridges <= 0) continue;
          bridges--;
        }
      }
      const sc = hnsw_score(h, store, nb, target);
      // push to candidates heap
      heap.push({ idx: nb, s: sc });
      // push to results maintaining top-ef
      pushSortedDesc(results, { idx: nb, s: sc }, ef);
    }
  }
  // results already sorted desc
  return results;
}

function connectMutually(h: HNSWState, a: number, neighbors: number[], level: number) {
  const la = (h.links[level][a] ||= []);
  for (const b of neighbors) {
    if (b === a) continue;
    if (!la.includes(b)) la.push(b);
    const lb = (h.links[level][b] ||= []);
    if (!lb.includes(a)) lb.push(a);
    if (la.length > h.M) la.sort((x, y) => x - y).splice(h.M);
    if (lb.length > h.M) lb.sort((x, y) => x - y).splice(h.M);
  }
}

/**
 *
 */
export function hnsw_add<TMeta>(h: HNSWState, store: CoreStore<TMeta>, id: number) {
  hnsw_ensureCapacity(h, store._capacity);
  const idx = getIndex(store, id);
  if (idx === undefined) return;
  const L = hnsw_sampleLevel(h);
  ensureLevels(h, L);
  h.levelArr[idx] = L;
  if (h.enterPoint < 0) {
    h.enterPoint = idx;
    h.maxLevel = L;
    for (let l = 0; l <= L; l++) {
      (h.links[l] ||= [])[idx] = h.links[l][idx] ||= [];
    }
    return;
  }
  let ep = h.enterPoint;
  if (h.maxLevel > L) ep = greedyDescent(h, store, ep, getByIndex(store, idx).vector, h.maxLevel);
  for (let l = Math.min(L, h.maxLevel); l >= 0; l--) {
    // explore neighbors locally from entry point on this level
    const cand = hnsw_searchLayer({
      h,
      store,
      entry: ep,
      target: getByIndex(store, idx).vector,
      level: l,
      ef: h.efConstruction,
    });
    const neigh = cand
      .filter((c) => c.idx !== idx)
      .slice(0, h.M)
      .map((c) => c.idx);
    connectMutually(h, idx, neigh, l);
    // update ep to nearest among neighbors
    let best = ep;
    let bestScore = hnsw_score(h, store, ep, getByIndex(store, idx).vector);
    for (const nb of neigh) {
      const sc = hnsw_score(h, store, nb, getByIndex(store, idx).vector);
      if (sc > bestScore) {
        best = nb;
        bestScore = sc;
      }
    }
    ep = best;
  }
  if (L > h.maxLevel) {
    h.enterPoint = idx;
    h.maxLevel = L;
  }
}

/**
 *
 */
export function hnsw_remove<TMeta>(h: HNSWState, store: CoreStore<TMeta>, id: number) {
  const idx = getIndex(store, id);
  if (idx === undefined) return;
  h.tombstone[idx] = 1;
  if (h.allowReplaceDeleted) {
    // placeholder
  }
}

/**
 *
 */
export function hnsw_search<TMeta>(
  h: HNSWState,
  store: CoreStore<TMeta>,
  q: Float32Array,
  args: { k: number; filter?: (id: number, meta: TMeta | null) => boolean; control?: HNSWSearchControl },
): SearchHit<TMeta>[] {
  if (h.enterPoint < 0 || store._count === 0) return [];
  const k = Math.max(1, args.k | 0);
  const filter = args.filter;
  const options = args.control;
  // optional multi-seed: select a better entry from candidate mask
  let startEp = h.enterPoint;
  if (options?.mask && options.seeds) {
    const ids = Array.from(options.mask);
    const n = ids.length;
    const numSeeds = computeNumSeeds(n, options.seeds);
    // Build candidate indices
    const idxs: number[] = [];
    for (let i = 0; i < n && idxs.length < numSeeds; i++) {
      const id = ids[i];
      const idx = store.pos.get(id);
      if (idx !== undefined) idxs.push(idx);
    }
    // If random strategy, shuffle a bit
    if ((options.seedStrategy ?? "random") === "random") {
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor((h.rng ? h.rng() : Math.random()) * (i + 1));
        const t = idxs[i];
        idxs[i] = idxs[j]!;
        idxs[j] = t;
      }
    }
    // Pick best by direct similarity
    let bestIdx = startEp;
    let bestSc = hnsw_score(h, store, bestIdx, q);
    for (const cand of idxs) {
      const sc = hnsw_score(h, store, cand, q);
      if (sc > bestSc) {
        bestSc = sc;
        bestIdx = cand;
      }
    }
    startEp = bestIdx;
  }
  // descend greedily from top layers starting at chosen entry
  const ep = greedyDescent(h, store, startEp, q, h.maxLevel);
  // do efSearch exploration on level 0
  // adaptive ef based on candidate mask size if provided
  let ef = h.efSearch;
  if (options?.adaptiveEf && options.mask && options.mask.size > 0) {
    const { base, min, max } = options.adaptiveEf;
    const cand = Math.max(1, Math.floor(base * Math.sqrt(options.mask.size)));
    ef = Math.max(min, Math.min(max, cand)) | 0;
  }
  const res = hnsw_searchLayer({ h, store, entry: ep, target: q, level: 0, ef, options });
  const out: SearchHit<TMeta>[] = [];
  for (const r of res) {
    const idVal = store.ids[r.idx];
    const meta = store.metas[r.idx];
    if (filter && !filter(idVal, meta)) continue;
    out.push({ id: idVal, score: r.s, meta });
    if (out.length >= k) break;
  }
  return out;
}

/**
 *
 */
export function hnsw_serialize(h: HNSWState, store: CoreStore<unknown>): ArrayBuffer {
  const paramsObj = { M: h.M, efConstruction: h.efConstruction, efSearch: h.efSearch, levelMult: h.levelMult };
  const paramsBytes = new TextEncoder().encode(JSON.stringify(paramsObj));
  const n = store._count;
  const lvlU8 = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    lvlU8[i] = (h.levelArr[i] ?? 0) & 0xff;
  }
  const tomb = new Uint8Array(h.tombstone.buffer.slice(0, n));
  const w = createWriter();
  w.pushU32(paramsBytes.length);
  w.pushBytes(paramsBytes);
  w.pushU32(h.enterPoint >>> 0);
  w.pushI32(h.maxLevel | 0);
  w.pushU32(lvlU8.length);
  w.pushBytes(lvlU8);
  w.pushU32(tomb.length);
  w.pushBytes(tomb);
  const Lmax = Math.max(0, h.maxLevel);
  w.pushU32(Lmax + 1);
  for (let l = 0; l <= Lmax; l++) {
    const layer = h.links[l] || [];
    const offsets = new Uint32Array(n + 1);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const deg = layer[i] ? layer[i].length : 0;
      offsets[i] = total;
      total += deg;
    }
    offsets[n] = total;
    const neigh = new Uint32Array(total);
    for (let i = 0; i < n; i++) {
      const arr = layer[i] || [];
      for (let j = 0; j < arr.length; j++) {
        neigh[offsets[i] + j] = arr[j] >>> 0;
      }
    }
    w.pushU32(offsets.length);
    w.pushBytes(new Uint8Array(offsets.buffer));
    w.pushU32(neigh.length);
    w.pushBytes(new Uint8Array(neigh.buffer));
  }
  return w.concat().buffer as ArrayBuffer;
}

/**
 *
 */
export function hnsw_deserialize(h: HNSWState, store: CoreStore<unknown>, seg: ArrayBufferLike): void {
  const r = createReader(seg);
  const paramsLen = r.readU32();
  const p = JSON.parse(new TextDecoder().decode(r.readBytes(paramsLen))) as Partial<HNSWParams> & {
    efConstruction?: number;
    efSearch?: number;
    levelMult?: number;
    M?: number;
  };
  if (typeof p.M === "number") h.M = p.M;
  if (typeof p.efConstruction === "number") h.efConstruction = p.efConstruction;
  if (typeof p.efSearch === "number") h.efSearch = p.efSearch;
  if (typeof p.levelMult === "number") h.levelMult = p.levelMult;
  h.enterPoint = r.readU32() | 0;
  h.maxLevel = r.readI32() | 0;
  const levelLen = r.readU32();
  const lvl = r.readBytes(levelLen);
  const tombLen = r.readU32();
  const tombB = r.readBytes(tombLen);
  h.levelArr = Array.from(lvl, (x) => x as number);
  h.tombstone = new Uint8Array(tombB);
  const numLayers = r.readU32();
  h.links = new Array(numLayers);
  const n = store._count;
  for (let l = 0; l < numLayers; l++) {
    const offLen = r.readU32();
    const offBytes = r.readBytes(offLen * 4);
    const offsets = new Uint32Array(offBytes.buffer);
    const nbrLen = r.readU32();
    const nbrBytes = r.readBytes(nbrLen * 4);
    const neighbors = new Uint32Array(nbrBytes.buffer);
    const layer: number[][] = new Array(n);
    for (let i = 0; i < n; i++) {
      const s = offsets[i],
        e = offsets[i + 1];
      const arr: number[] = [];
      for (let j = s; j < e; j++) {
        arr.push(neighbors[j] as number);
      }
      layer[i] = arr;
    }
    h.links[l] = layer;
  }
}
/**
 * HNSW (Hierarchical Navigable Small World) graph-based ANN search.
 *
 * Why: Enable fast approximate nearest neighbor search that scales beyond the
 * practicality of bruteforce while keeping a simple, dependency-free TS design.
 * We also expose optional exploration controls to integrate attribute-driven
 * preselection without hard-coding policy into the graph itself.
 */
