/**
 * @file Data segmenter (writes segments only and returns pointers)
 */
import type { VectorStoreState } from "../../types";
import { DataSegmentWriter } from "../formats/data_segment";
import type { IndexEntry } from "../types";
import type { CrushMap } from "../types";
import { crushLocate } from "./crush";
import type { ResolveDataIO } from "../types";

export type SegmentationOptions = {
  baseName: string;
  crush: CrushMap;
  resolveDataIO: ResolveDataIO;
  segmented?: boolean;
  segmentBytes?: number;
};

export type SegmentManifest = { base: string; segments: { name: string; targetKey: string }[] };

/**
 * Data segmentation: write only data segments to target storages and return
 * pointers for index building. No index IO is performed here.
 */
/**
 * Write data segments according to CRUSH mapping and return index entries.
 */
export async function writeSegments<TMeta>(
  vl: VectorStoreState<TMeta>,
  opts: SegmentationOptions,
): Promise<{ entries: IndexEntry[]; manifest: SegmentManifest; dim: number; count: number }> {
  const base = opts.baseName;
  const segmented = !!opts.segmented;
  const segLimit = Math.max(1, opts.segmentBytes ?? 64 * 1024 * 1024);

  type SegWriter = { writer: DataSegmentWriter; size: number; part: number; targetKey: string };
  const writers = new Map<number, SegWriter>();
  const entries: IndexEntry[] = [];

  const count = vl.store._count;
  const dim = vl.dim;
  for (let i = 0; i < count; i++) {
    const id = vl.store.ids[i];
    const { pg, primaries } = crushLocate(id, opts.crush);
    const targetKey = primaries[0] ?? "local";
    const seg =
      writers.get(pg) ??
      (() => {
        const name = `${base}.pg${pg}.part0`;
        const s: SegWriter = { writer: new DataSegmentWriter(name), size: 8, part: 0, targetKey };
        writers.set(pg, s);
        return s;
      })();
    const vec = vl.store.data.subarray(i * dim, (i + 1) * dim);
    const meta = vl.store.metas[i];
    const recSize = 4 + 4 + 4 + JSON.stringify(meta).length + vec.byteLength;
    if (segmented && seg.size + recSize > segLimit) {
      seg.part += 1;
      const name = `${base}.pg${pg}.part${seg.part}`;
      seg.writer = new DataSegmentWriter(name);
      seg.size = 8;
    }
    const ptr = seg.writer.append({ id, vector: vec, meta });
    seg.size += ptr.length;
    entries.push({ id, ptr: { segment: seg.writer.name, offset: ptr.offset, length: ptr.length } });
  }
  // flush data segments
  for (const [, seg] of writers) {
    const io = opts.resolveDataIO(seg.targetKey);
    await seg.writer.writeAtomic(io, `${seg.writer.name}.data`);
  }
  const manifest: SegmentManifest = {
    base,
    segments: Array.from(writers.values()).map((w) => ({ name: w.writer.name, targetKey: w.targetKey })),
  };
  return { entries, manifest, dim, count };
}
