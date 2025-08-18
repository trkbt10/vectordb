import { CoreStore, getByIndex, getIndex } from "../core/store";
import { HNSWParams, Metric, SearchHit } from "../types";
import { createReader, createWriter } from "../util/bin";
import { dotAt, l2negAt } from "../util/math";
import { pushSortedDesc } from "../util/topk";

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

export function hnsw_ensureCapacity(h: HNSWState, capacity: number) {
  if (h.levelArr.length >= capacity && h.tombstone.length >= capacity) return;
  if (h.levelArr.length < capacity) h.levelArr = h.levelArr.concat(new Array(capacity - h.levelArr.length).fill(0));
  if (h.tombstone.length < capacity) {
    const t = new Uint8Array(capacity);
    t.set(h.tombstone);
    h.tombstone = t;
  }
}

function hnsw_score(h: HNSWState, store: CoreStore<unknown>, idx: number, q: Float32Array): number {
  const dim = store.dim;
  const base = idx * dim;
  return h.metric === "cosine" ? dotAt(store.data, base, q, dim) : l2negAt(store.data, base, q, dim);
}

function hnsw_sampleLevel(h: HNSWState): number {
  const u = Math.max(Number.EPSILON, h.rng());
  return Math.floor(-Math.log(u) * h.levelMult);
}

function ensureLevels(h: HNSWState, L: number) {
  while (h.links.length <= L) h.links.push([]);
}

function greedyDescent(
  h: HNSWState,
  store: CoreStore<unknown>,
  ep: number,
  target: Float32Array,
  fromLevel: number
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

function hnsw_searchLayer(
  h: HNSWState,
  store: CoreStore<unknown>,
  entry: number,
  target: Float32Array,
  level: number,
  ef: number
): Scored[] {
  const visited = new Uint8Array(store._count);
  const candidates: Scored[] = [];
  const results: Scored[] = [];
  const entryScore = hnsw_score(h, store, entry, target);
  candidates.push({ idx: entry, s: entryScore });
  results.push({ idx: entry, s: entryScore });
  visited[entry] = 1;

  while (candidates.length) {
    // get best candidate
    candidates.sort((a, b) => b.s - a.s);
    const cur = candidates.shift() as Scored;
    const worst = results[results.length - 1]?.s ?? Number.NEGATIVE_INFINITY;
    if (results.length >= ef && cur.s <= worst) {
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
      const sc = hnsw_score(h, store, nb, target);
      // push to candidates
      candidates.push({ idx: nb, s: sc });
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
  if (h.maxLevel > L) ep = greedyDescent(h, store as CoreStore<unknown>, ep, getByIndex(store, idx).vector, h.maxLevel);
  for (let l = Math.min(L, h.maxLevel); l >= 0; l--) {
    // explore neighbors locally from entry point on this level
    const cand = hnsw_searchLayer(
      h,
      store as CoreStore<unknown>,
      ep,
      getByIndex(store, idx).vector,
      l,
      h.efConstruction
    );
    const neigh = cand
      .filter((c) => c.idx !== idx)
      .slice(0, h.M)
      .map((c) => c.idx);
    connectMutually(h, idx, neigh, l);
    // update ep to nearest among neighbors
    let best = ep;
    let bestScore = hnsw_score(h, store as CoreStore<unknown>, ep, getByIndex(store, idx).vector);
    for (const nb of neigh) {
      const sc = hnsw_score(h, store as CoreStore<unknown>, nb, getByIndex(store, idx).vector);
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

export function hnsw_remove<TMeta>(h: HNSWState, store: CoreStore<TMeta>, id: number) {
  const idx = getIndex(store, id);
  if (idx === undefined) return;
  h.tombstone[idx] = 1;
  if (h.allowReplaceDeleted) {
    // placeholder
  }
}

export function hnsw_search<TMeta>(
  h: HNSWState,
  store: CoreStore<TMeta>,
  q: Float32Array,
  k: number,
  filter?: (id: number, meta: TMeta | null) => boolean
): SearchHit<TMeta>[] {
  if (h.enterPoint < 0 || store._count === 0) return [];
  // descend greedily from top layers
  const ep = greedyDescent(h, store as unknown as CoreStore<unknown>, h.enterPoint, q, h.maxLevel);
  // do efSearch exploration on level 0
  const res = hnsw_searchLayer(h, store as unknown as CoreStore<unknown>, ep, q, 0, h.efSearch);
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
