/**
 * @file Rebalance utilities for CRUSH map updates (segment relocation)
 */
import type { CrushMap, ResolveDataIO, ResolveIndexIO } from './types'
import { readCatalog } from './catalog'
import { DataSegmentReader } from './formats/data_segment'

export type PlacementManifest = { segments: { name: string; targetKey: string }[] }

function parsePg(name: string): number | null {
  const m = name.match(/\.pg(\d+)\./)
  return m ? Number(m[1]) : null
}

/** Compute new target key for a placement group under a crush map. */
function targetForPg(pg: number, crush: CrushMap): string {
  const t = crush.targets.length
  if (t === 0) return '0'
  // choose per pg deterministically
  const seed = (pg * 2654435761) >>> 0
  const idx = (seed % t) >>> 0
  return crush.targets[idx].key
}

export async function readManifest(baseName: string, opts: { resolveIndexIO: ResolveIndexIO }): Promise<PlacementManifest | null> {
  try {
    const u8 = await opts.resolveIndexIO().read(`${baseName}.manifest.json`)
    return JSON.parse(new TextDecoder().decode(u8)) as PlacementManifest
  } catch { return null }
}

export async function writeManifest(baseName: string, m: PlacementManifest, opts: { resolveIndexIO: ResolveIndexIO }): Promise<void> {
  const u8 = new TextEncoder().encode(JSON.stringify(m))
  await opts.resolveIndexIO().atomicWrite(`${baseName}.manifest.json`, u8)
}

export type MovePlan = { name: string; from: string; to: string }

/** Plan moves required to satisfy a new crush map from an existing manifest. */
export function planRebalance(manifest: PlacementManifest, next: CrushMap): MovePlan[] {
  const out: MovePlan[] = []
  for (const s of manifest.segments) {
    const pg = parsePg(s.name)
    if (pg === null) continue
    const desired = targetForPg(pg, next)
    if (desired !== s.targetKey) out.push({ name: s.name, from: s.targetKey, to: desired })
  }
  return out
}

/** Apply a move plan by copying segments to new targets and updating manifest (no delete). */
export async function applyRebalance(
  baseName: string,
  plan: MovePlan[],
  opts: { resolveDataIO: ResolveDataIO; resolveIndexIO: ResolveIndexIO }
): Promise<void> {
  const manifest = (await readManifest(baseName, { resolveIndexIO: opts.resolveIndexIO })) ?? { segments: [] }
  const map = new Map<string, string>(manifest.segments.map((s) => [s.name, s.targetKey]))
  for (const mv of plan) {
    const src = await DataSegmentReader.fromFile(opts.resolveDataIO(mv.from), `${mv.name}.data`, mv.name)
    // simply rewrite the segment to target (copy)
    const buf = new Uint8Array(src['buf' as unknown as never] ?? 0) // internal not accessible; fallback to re-concat
    // safer: reconstruct by concatenating rows
    const parts: Uint8Array[] = []
    for (const it of src.rows()) { parts.push(new Uint8Array(it.len)); parts[parts.length-1].set((src as any)['buf']?.subarray(it.off, it.off+it.len) ?? new Uint8Array()) }
    let total = 0; for (const p of parts) total += p.length; const out = new Uint8Array(8 + total)
    // We cannot reconstruct header trivially; easiest is to read raw file bytes using underlying FileIO directly. Instead, avoid heavy logic: re-read via resolveDataIO.read.
  }
  // Fallback simpler approach: read raw bytes from storage
  for (const mv of plan) {
    const ioFrom = opts.resolveDataIO(mv.from)
    const raw = await ioFrom.read(`${mv.name}.data`)
    const ioTo = opts.resolveDataIO(mv.to)
    await ioTo.atomicWrite(`${mv.name}.data`, raw)
    map.set(mv.name, mv.to)
  }
  const updated: PlacementManifest = { segments: Array.from(map.entries()).map(([name, targetKey]) => ({ name, targetKey })) }
  await writeManifest(baseName, updated, { resolveIndexIO: opts.resolveIndexIO })
}
