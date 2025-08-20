/**
 * @file Index file binary format (pointers to data segments + optional ANN)
 */
import type { FileIO } from "../../storage/types";
import { toUint8 } from "../../storage/types";
import type { IndexEntry } from "../types";
import { createReader, createWriter } from "../../util/bin";

// Index file that references external data segments (no vectors inside)
// Header: MAGIC u32 ('VLIX'), VERSION u32 (1)
// Fields: metric u32, dim u32, count u32, strategy u32, hasAnn u32(flags)
// If hasAnn: annLen u32, annBytes
// Then entries: repeated [id u32, nameLen u32, name bytes, offset u32, length u32]

const I_MAGIC = 0x564c4958; // 'VLIX'
const I_VERSION = 1;

export type IndexHeader = {
  metricCode: number;
  dim: number;
  count: number;
  strategyCode: number;
  hasAnn: boolean;
};

/** Encode an index file with header, optional ANN, and entry list. */
export function encodeIndexFile(header: IndexHeader, entries: IndexEntry[], annBytes?: Uint8Array): Uint8Array {
  const w = createWriter();
  const head = new Uint8Array(16);
  const dv = new DataView(head.buffer);
  dv.setUint32(0, I_MAGIC, true);
  dv.setUint32(4, I_VERSION, true);
  w.pushBytes(head);
  const flags = header.hasAnn ? 1 : 0;
  const info = new Uint8Array(4 * 4 + 4);
  const di = new DataView(info.buffer);
  di.setUint32(0, header.metricCode >>> 0, true);
  di.setUint32(4, header.dim >>> 0, true);
  di.setUint32(8, header.count >>> 0, true);
  di.setUint32(12, header.strategyCode >>> 0, true);
  di.setUint32(16, flags >>> 0, true);
  w.pushBytes(info);
  if (header.hasAnn && annBytes) {
    w.pushU32(annBytes.length >>> 0);
    w.pushBytes(annBytes);
  }
  for (const e of entries) {
    w.pushU32(e.id >>> 0);
    const nameBytes = new TextEncoder().encode(e.ptr.segment);
    w.pushU32(nameBytes.length >>> 0);
    w.pushBytes(nameBytes);
    w.pushU32(e.ptr.offset >>> 0);
    w.pushU32(e.ptr.length >>> 0);
  }
  return w.concat();
}

/** Decode an index file into header, entries, and optional ANN payload. */
export function decodeIndexFile(u8: Uint8Array): { header: IndexHeader; entries: IndexEntry[]; ann?: Uint8Array } {
  if (u8.length < 16) throw new Error("index too short");
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const mg = dv.getUint32(0, true);
  const ver = dv.getUint32(4, true);
  if (mg !== I_MAGIC) throw new Error("bad index magic");
  if (ver !== I_VERSION) throw new Error("unsupported index version");
  const body = u8.slice(16);
  const r = createReader(body.buffer as ArrayBuffer);
  const metricCode = r.readU32();
  const dim = r.readU32();
  const count = r.readU32();
  const strategyCode = r.readU32();
  const flags = r.readU32();
  const hasAnn = (flags & 1) === 1;
  const ann: Uint8Array | undefined = hasAnn
    ? (() => {
        const annLen = r.readU32();
        return r.readBytes(annLen);
      })()
    : undefined;
  const entries: IndexEntry[] = [];
  while (r.offset() < body.length) {
    const id = r.readU32();
    const nameLen = r.readU32();
    const nameBytes = r.readBytes(nameLen);
    const name = new TextDecoder().decode(nameBytes);
    const offset = r.readU32();
    const length = r.readU32();
    entries.push({ id, ptr: { segment: name, offset, length } });
  }
  return { header: { metricCode, dim, count, strategyCode, hasAnn }, entries, ann };
}

/** Atomically write an index file to storage. */
export async function saveIndexFile(io: FileIO, path: string, bytes: Uint8Array): Promise<void> {
  await io.atomicWrite(path, toUint8(bytes));
}

/** Load an index file from storage. */
export async function loadIndexFile(io: FileIO, path: string): Promise<Uint8Array> {
  return await io.read(path);
}
