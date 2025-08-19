/**
 * @file Deterministic CRUSH-like mapping utilities for indexing placement
 */
import type { CrushMap, LocateResult } from './types'

// Simple CRUSH-like deterministic mapping
// 1) id -> pg via modulo of a stable hash
// 2) chooseleaf: replica selection per pg with stable hashing

function hash32(x: number): number {
  const a = (x ^ (x >>> 16)) >>> 0
  const b = (a * 0x7feb352d) >>> 0
  const c = (b ^ (b >>> 15)) >>> 0
  const d = (c * 0x846ca68b) >>> 0
  const e = (d ^ (d >>> 16)) >>> 0
  return e >>> 0
}

function findUnusedIndex(start: number, used: Set<number>, t: number, tried = 0): number {
  if (tried >= t) return start
  return used.has(start) ? findUnusedIndex((start + 1) % t, used, t, tried + 1) : start
}

function choosePrimaries(pg: number, replicas: number, t: number): number[] {
  const used = new Set<number>()
  const limit = Math.min(Math.max(1, replicas | 0), t)
  const base = ((pg * 2654435761) >>> 0) >>> 0
  function loop(r: number, acc: number[]): number[] {
    if (r >= limit) return acc
    const seed = hash32(base + r)
    const pick = seed % t
    const idx = findUnusedIndex(pick, used, t)
    used.add(idx)
    return loop(r + 1, acc.concat(idx))
  }
  return loop(0, [])
}

/** Determine placement group and primary targets for a given id. */
export function crushLocate(id: number, map: CrushMap): LocateResult {
  const pg = map.pgs > 0 ? (hash32(id >>> 0) % map.pgs) : 0
  const t = map.targets.length
  if (t === 0) return { pg, primaries: [] }
  const idxs = choosePrimaries(pg, map.replicas, t)
  const primaries = idxs.map((i) => map.targets[i].key)
  return { pg, primaries }
}
