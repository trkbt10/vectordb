/**
 * @file Inverted File (IVF) index and retraining utilities.
 */

/**
 * Inverted File (IVF) index and retraining utilities.
 *
 * Why: Provide a pluggable ANN strategy that supports centroid-based routing
 * and explicit, operator-controlled retraining (no auto-apply). Exposes
 * k-means training, list reassignment, and a simple recall/latency evaluator.
 *
 * Notes:
 * - We do not mutate nlist dynamically in training; training uses the current
 *   state's `nlist`. For different `k`, rebuild with a new state.
 * - For cosine/dot metrics we normalize centroids after recomputation.
 */
import { CoreStore, getIndex } from "../core/store";
import { Metric, SearchHit } from "../types";
import { getScoreAtFn } from "../util/similarity";

export type IVFParams = {
  nlist?: number;
  nprobe?: number;
};

export type IVFState = {
  type: "ivf";
  metric: Metric;
  nlist: number;
  nprobe: number;
  centroidCount: number;
  centroids: Float32Array; // length = nlist * dim (dim is store.dim)
  lists: Array<number[]>; // posting lists of ids
  idToList: Map<number, number>;
};

/**
 *
 */
export function createIVFState(params: IVFParams, metric: Metric, dim: number): IVFState {
  const nlist = Math.max(1, params.nlist ?? 64);
  const nprobe = Math.max(1, Math.min(nlist, params.nprobe ?? Math.ceil(Math.sqrt(nlist))));
  return {
    type: "ivf",
    metric,
    nlist,
    nprobe,
    centroidCount: 0,
    centroids: new Float32Array(nlist * dim),
    lists: new Array(nlist).fill(0).map(() => []),
    idToList: new Map<number, number>(),
  };
}

export type KMeansOptions = {
  iters?: number;
  seed?: number;
};

function createRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    // xorshift32
    let x = s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s = x >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

function normalizeVec(v: Float32Array): void {
  let ss = 0;
  for (let i = 0; i < v.length; i++) ss += v[i] * v[i];
  const n = Math.sqrt(ss) || 1;
  for (let i = 0; i < v.length; i++) v[i] = v[i] / n;
}

function argmax(scores: Float32Array): number {
  let bi = 0;
  let bv = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    const v = scores[i];
    if (v > bv) {
      bv = v;
      bi = i;
    }
  }
  return bi;
}

/** Train IVF centroids via k-means using current store data. */
export function ivf_trainCentroids<TMeta>(
  ivf: IVFState,
  store: CoreStore<TMeta>,
  opts: KMeansOptions = {}
): { updated: number } {
  const n = store._count;
  const dim = store.dim;
  const k = ivf.nlist;
  if (n === 0 || k === 0) return { updated: 0 };
  const rng = createRng((opts.seed ?? 42) >>> 0);
  // Initialize with k distinct random ids (or fewer if n<k)
  const chosen = new Set<number>();
  while (chosen.size < Math.min(k, n)) {
    const pick = Math.floor(rng() * n);
    chosen.add(pick);
  }
  const cents = new Float32Array(k * dim);
  let ci = 0;
  for (const idx of chosen) {
    const base = idx * dim;
    for (let d = 0; d < dim; d++) cents[ci * dim + d] = store.data[base + d];
    if (ivf.metric !== "l2") normalizeVec(cents.subarray(ci * dim, (ci + 1) * dim));
    ci++;
    if (ci >= k) break;
  }
  // If picked less than k (n<k), duplicate heads
  for (; ci < k; ci++) {
    const from = ci % Math.max(1, chosen.size);
    const base = from * dim;
    for (let d = 0; d < dim; d++) cents[ci * dim + d] = cents[base + d];
  }
  // Iterative refinement
  const iters = Math.max(1, opts.iters ?? 10);
  const scoreAt = getScoreAtFn(ivf.metric);
  const assign = new Uint32Array(n);
  const scores = new Float32Array(k);
  const sums = new Float64Array(k * dim);
  const counts = new Uint32Array(k);
  for (let it = 0; it < iters; it++) {
    // reset accumulators
    for (let j = 0; j < sums.length; j++) sums[j] = 0;
    for (let j = 0; j < counts.length; j++) counts[j] = 0;
    // assign
    for (let i = 0; i < n; i++) {
      const base = i * dim;
      for (let c = 0; c < k; c++) {
        const off = c * dim;
        // scoreAt expects a contiguous vector in data and query; we adapt by computing score vs centroid
        // Implement scoreAt(data, base, q, dim) -> we create a temporary score using dot/L2 via inline loop
        let s = 0;
        if (ivf.metric === "l2") {
          // negative L2
          let acc = 0;
          for (let d = 0; d < dim; d++) {
            const diff = store.data[base + d] - cents[off + d];
            acc += diff * diff;
          }
          s = -acc;
        } else if (ivf.metric === "dot" || ivf.metric === "cosine") {
          let acc = 0;
          for (let d = 0; d < dim; d++) acc += store.data[base + d] * cents[off + d];
          s = acc;
        }
        scores[c] = s;
      }
      const best = argmax(scores);
      assign[i] = best >>> 0;
      counts[best]++;
      const soff = best * dim;
      for (let d = 0; d < dim; d++) sums[soff + d] += store.data[base + d];
    }
    // recompute centroids
    for (let c = 0; c < k; c++) {
      const cnt = counts[c];
      const off = c * dim;
      if (cnt === 0) continue; // keep previous
      for (let d = 0; d < dim; d++) cents[off + d] = sums[off + d] / cnt;
      if (ivf.metric !== "l2") normalizeVec(cents.subarray(off, off + dim));
    }
  }
  // write back
  ivf.centroids.set(cents);
  ivf.centroidCount = k;
  return { updated: k };
}

/** Reassign all ids into IVF posting lists based on current centroids. */
export function ivf_reassignLists<TMeta>(ivf: IVFState, store: CoreStore<TMeta>): { moved: number } {
  const n = store._count;
  const dim = store.dim;
  const k = ivf.nlist;
  // clear
  ivf.idToList.clear();
  for (let i = 0; i < ivf.lists.length; i++) ivf.lists[i] = [];
  if (n === 0 || k === 0 || ivf.centroidCount === 0) return { moved: 0 };
  const scores = new Float32Array(k);
  for (let i = 0; i < n; i++) {
    const base = i * dim;
    for (let c = 0; c < k; c++) {
      const off = c * dim;
      let s = 0;
      if (ivf.metric === "l2") {
        let acc = 0;
        for (let d = 0; d < dim; d++) {
          const diff = store.data[base + d] - ivf.centroids[off + d];
          acc += diff * diff;
        }
        s = -acc;
      } else {
        let acc = 0;
        for (let d = 0; d < dim; d++) acc += store.data[base + d] * ivf.centroids[off + d];
        s = acc;
      }
      scores[c] = s;
    }
    const best = argmax(scores);
    const id = store.ids[i];
    ivf.idToList.set(id, best);
    ivf.lists[best]!.push(id);
  }
  return { moved: n };
}

/** Evaluate IVF by comparing with bruteforce top-k; returns average recall and latency. */
export function ivf_evaluate<TMeta>(
  ivf: IVFState,
  store: CoreStore<TMeta>,
  queries: Float32Array[],
  k: number
): { recall: number; latency: number } {
  const dim = store.dim;
  const bfTopK = (q: Float32Array, kk: number): number[] => {
    const out: { id: number; score: number }[] = [];
    for (let i = 0; i < store._count; i++) {
      const id = store.ids[i];
      const base = i * dim;
      let s = 0;
      if (ivf.metric === "l2") {
        let acc = 0;
        for (let d = 0; d < dim; d++) {
          const diff = store.data[base + d] - q[d];
          acc += diff * diff;
        }
        s = -acc;
      } else {
        let acc = 0;
        for (let d = 0; d < dim; d++) acc += store.data[base + d] * q[d];
        s = acc;
      }
      // insert sorted desc
      let pos = out.length;
      for (let j = 0; j < out.length; j++) {
        if (s > out[j]!.score) {
          pos = j;
          break;
        }
      }
      out.splice(pos, 0, { id, score: s });
      if (out.length > kk) out.length = kk;
    }
    return out.map((x) => x.id);
  };
  let sumRecall = 0;
  let sumLatency = 0;
  for (const q of queries) {
    const t0 = Date.now();
    // use existing search path for ivf
    const hits = ivf_search(ivf, store, q, k);
    const dt = Date.now() - t0;
    sumLatency += dt;
    const truth = new Set(bfTopK(q, k));
    let inter = 0;
    for (const h of hits) {
      if (truth.has(h.id)) inter++;
    }
    sumRecall += inter / Math.max(1, k);
  }
  const n = Math.max(1, queries.length);
  return { recall: sumRecall / n, latency: sumLatency / n };
}

function nearestCentroid<TMeta>(h: IVFState, store: CoreStore<TMeta>, vec: Float32Array): number {
  const dim = store.dim;
  const scoreAt = getScoreAtFn(h.metric);
  let best = -1;
  let bestScore = -Infinity;
  const baseC = h.centroids;
  const count = Math.max(1, h.centroidCount);
  for (let c = 0; c < count; c++) {
    const base = c * dim;
    const sc = scoreAt(baseC, base, vec, dim);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return best >>> 0;
}

/**
 *
 */
export function ivf_add<TMeta>(h: IVFState, store: CoreStore<TMeta>, id: number): void {
  const idx = store.pos.get(id >>> 0) ?? -1;
  if (idx < 0) return;
  const base = idx * store.dim;
  const vec = store.data.subarray(base, base + store.dim);
  // Initialize centroids with first nlist vectors
  if (h.centroidCount < h.nlist) {
    const c = h.centroidCount;
    h.centroids.set(vec, c * store.dim);
    h.centroidCount++;
    h.lists[c].push(id >>> 0);
    h.idToList.set(id >>> 0, c);
    return;
  }
  const c = nearestCentroid(h, store, vec);
  h.lists[c].push(id >>> 0);
  h.idToList.set(id >>> 0, c);
}

/**
 *
 */
export function ivf_remove<TMeta>(h: IVFState, _store: CoreStore<TMeta>, id: number): void {
  const uid = id >>> 0;
  const li = h.idToList.get(uid);
  if (li === undefined) return;
  const arr = h.lists[li];
  const pos = arr.indexOf(uid);
  if (pos >= 0) arr.splice(pos, 1);
  h.idToList.delete(uid);
}

/**
 *
 */
export function ivf_search<TMeta>(
  h: IVFState,
  store: CoreStore<TMeta>,
  q: Float32Array,
  k: number,
  filter?: (id: number, meta: TMeta | null) => boolean
): SearchHit<TMeta>[] {
  const dim = store.dim;
  if (q.length !== dim) {
    throw new Error(`dim mismatch: got ${q.length}, want ${dim}`);
  }
  const scoreAt = getScoreAtFn(h.metric);
  // Pick nprobe centroids by score
  const scores: Array<{ c: number; s: number }> = [];
  const count = Math.max(1, h.centroidCount);
  for (let c = 0; c < count; c++) {
    const s = scoreAt(h.centroids, c * dim, q, dim);
    scores.push({ c, s });
  }
  scores.sort((a, b) => b.s - a.s);
  const probe = Math.min(h.nprobe, scores.length);
  const out: SearchHit<TMeta>[] = [];
  for (let i = 0; i < probe; i++) {
    const list = h.lists[scores[i]!.c];
    for (const id of list) {
      const at = store.pos.get(id);
      if (at === undefined) continue;
      const meta = store.metas[at];
      if (filter && !filter(id, meta)) continue;
      const base = at * dim;
      const s = scoreAt(store.data, base, q, dim);
      // simple insert sort for k (small k)
      let ins = out.length;
      for (let j = 0; j < out.length; j++) {
        if (s > out[j]!.score) {
          ins = j;
          break;
        }
      }
      out.splice(ins, 0, { id, score: s, meta });
      if (out.length > k) out.length = k;
    }
  }
  return out;
}

/**
 *
 */
export function ivf_serialize(h: IVFState, store: CoreStore<unknown>): ArrayBuffer {
  const dim = store.dim;
  const header = new Uint32Array([h.nlist >>> 0, h.nprobe >>> 0, h.centroidCount >>> 0, dim >>> 0]);
  const listsData = JSON.stringify(h.lists);
  const listsBytes = new TextEncoder().encode(listsData);
  const centBytes = new Uint8Array(h.centroids.buffer.slice(0));
  const out = new Uint8Array(16 + 4 + listsBytes.length + centBytes.length);
  out.set(new Uint8Array(header.buffer), 0);
  new DataView(out.buffer).setUint32(16, listsBytes.length >>> 0, true);
  out.set(listsBytes, 20);
  out.set(centBytes, 20 + listsBytes.length);
  return out.buffer;
}

/**
 *
 */
export function ivf_deserialize(h: IVFState, store: CoreStore<unknown>, buf: ArrayBuffer): void {
  const dv = new DataView(buf);
  const nlist = dv.getUint32(0, true);
  const nprobe = dv.getUint32(4, true);
  const ccount = dv.getUint32(8, true);
  const dim = dv.getUint32(12, true);
  const listsLen = dv.getUint32(16, true);
  const listsBytes = new Uint8Array(buf, 20, listsLen);
  const lists = JSON.parse(new TextDecoder().decode(listsBytes)) as number[][];
  const centStart = 20 + listsLen;
  const centBytes = new Uint8Array(buf, centStart);
  const cent = new Float32Array(
    centBytes.buffer.slice(centBytes.byteOffset, centBytes.byteOffset + centBytes.byteLength)
  );
  h.nlist = nlist;
  h.nprobe = nprobe;
  h.centroidCount = ccount;
  h.centroids = cent;
  h.lists = lists;
  h.idToList.clear();
  for (let li = 0; li < lists.length; li++) {
    for (const id of lists[li]!) h.idToList.set(id >>> 0, li);
  }
  if (cent.length !== nlist * dim) {
    // Resize to fit current dim even if serialized dim differs
    const fixed = new Float32Array(nlist * store.dim);
    fixed.set(cent.subarray(0, Math.min(cent.length, fixed.length)));
    h.centroids = fixed;
  }
}
