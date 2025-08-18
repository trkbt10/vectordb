import { search } from '../vectorlite/ops'
import { searchWithExpr } from './with_expr'
import type { VectorLiteState } from '../vectorlite/state'
import type { FilterExpr } from '../filter/expr'
import type { SearchHit } from '../types'

export type ShardPlan = {
  shards: { name: string; ids: number[] }[]
}

export function createShardPlanByRange(ids: number[], shards: number): ShardPlan {
  const sorted = Array.from(ids).sort((a,b)=>a-b)
  const out: ShardPlan = { shards: [] }
  const n = Math.max(1, shards|0)
  for (let i=0;i<n;i++) out.shards.push({ name: `shard-${i}`, ids: [] })
  for (let i=0;i<sorted.length;i++) out.shards[i % n]!.ids.push(sorted[i]!)
  return out
}

/** Create shard plan by hashing id modulo shard count. */
export function createShardPlanByHash(ids: number[], shards: number): ShardPlan {
  const out: ShardPlan = { shards: [] }
  const n = Math.max(1, shards|0)
  for (let i=0;i<n;i++) out.shards.push({ name: `shard-${i}`, ids: [] })
  for (const id of ids) out.shards[(id >>> 0) % n]!.ids.push(id)
  return out
}

/** Convenience wrapper: choose plan by 'range' or 'hash'. */
export function createShardPlan(ids: number[], opts: { by: 'range'|'hash'; shards: number }): ShardPlan {
  return opts.by === 'hash' ? createShardPlanByHash(ids, opts.shards) : createShardPlanByRange(ids, opts.shards)
}

export function searchParallel<TMeta>(
  vl: VectorLiteState<TMeta>,
  q: Float32Array,
  opts: { k: number; plan?: ShardPlan; expr?: FilterExpr }
) {
  const plan = opts.plan ?? createShardPlanByRange(Array.from(vl.store.ids.subarray(0, vl.store._count)), 1)
  const k = Math.max(1, opts.k|0)
  const out: SearchHit<TMeta>[] = []
  for (const shard of plan.shards) {
    const expr: FilterExpr = opts.expr
      ? { has_id: { values: shard.ids }, must: [opts.expr] }
      : { has_id: { values: shard.ids } }
    const res = searchWithExpr(vl, q, expr, { k })
    for (const h of res) {
      let ins = out.length
      for (let i=0;i<out.length;i++){ if (h.score > out[i]!.score){ ins=i; break } }
      out.splice(ins, 0, h)
      if (out.length > k) out.length = k
    }
  }
  return out
}
