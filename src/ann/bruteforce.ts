import { CoreStore } from "../core/store";
import { Metric, SearchHit } from "../types";
import { pushTopK } from "../util/topk";
import { getScoreAtFn } from "../util/similarity";

export type BruteforceState = { type: "bruteforce"; metric: Metric };

export function createBruteforceState(metric: Metric): BruteforceState {
  return { type: "bruteforce", metric };
}

export function bf_add<TMeta>(_bf: BruteforceState, _store: CoreStore<TMeta>, _id: number): void {
  // no-op
}

export function bf_remove<TMeta>(_bf: BruteforceState, _store: CoreStore<TMeta>, _id: number): void {
  // no-op
}

export function bf_search<TMeta>(
  bf: BruteforceState,
  store: CoreStore<TMeta>,
  q: Float32Array,
  k: number,
  filter?: (id: number, meta: TMeta | null) => boolean
): SearchHit<TMeta>[] {
  const dim = store.dim;
  if (q.length !== dim) {
    throw new Error(`dim mismatch: got ${q.length}, want ${dim}`);
  }
  const out: SearchHit<TMeta>[] = [];
  const data = store.data;
  const scoreAt = getScoreAtFn(bf.metric);
  for (let i = 0; i < store._count; i++) {
    const id = store.ids[i];
    const meta = store.metas[i];
    if (filter && !filter(id, meta)) {
      continue;
    }
    const base = i * dim;
    const s = scoreAt(data, base, q, dim);
    // adapt to Scored.s naming for util: map score->s when pushing
    pushTopK(out, { id, score: s, meta }, k, (x) => x.score)
  }
  return out;
}

export function bf_serialize(_bf: BruteforceState): ArrayBuffer {
  return new Uint8Array(0).buffer;
}
export function bf_deserialize(_bf: BruteforceState, _buf: ArrayBuffer): void {}
