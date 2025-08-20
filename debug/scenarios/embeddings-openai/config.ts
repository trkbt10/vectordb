/**
 * @file Configuration utilities for environment variables
 */

export function getApiKey(): string {
  return process.env.OPENAI_API_KEY_FOR_EMBEDDING ?? process.env.OPENAI_API_KEY ?? "";
}

export function getMetric(): "cosine" | "l2" | "dot" {
  const m = (process.env.VECTORLITE_METRIC ?? "cosine").toLowerCase();
  return m === "cosine" || m === "l2" || m === "dot" ? (m as "cosine" | "l2" | "dot") : "cosine";
}

export function getAttrStrategy(): "basic" | "bitmap" {
  const a = (process.env.VECTORLITE_ATTR_INDEX ?? "bitmap").toLowerCase();
  return a === "basic" || a === "bitmap" ? (a as "basic" | "bitmap") : "bitmap";
}

export function getHnswParams(): { efSearch?: number; M?: number } {
  const ef = Number(process.env.VECTORLITE_HNSW_EF_SEARCH ?? "");
  const m = Number(process.env.VECTORLITE_HNSW_M ?? "");
  const obj: { efSearch?: number; M?: number } = {};
  if (Number.isFinite(ef) && ef > 0) obj.efSearch = Math.floor(ef);
  if (Number.isFinite(m) && m > 0) obj.M = Math.floor(m);
  return obj;
}

export function getIvfParams(): { nlist?: number; nprobe?: number } {
  const nl = Number(process.env.VECTORLITE_IVF_NLIST ?? "");
  const np = Number(process.env.VECTORLITE_IVF_NPROBE ?? "");
  const obj: { nlist?: number; nprobe?: number } = {};
  if (Number.isFinite(nl) && nl > 0) obj.nlist = Math.floor(nl);
  if (Number.isFinite(np) && np > 0) obj.nprobe = Math.floor(np);
  return obj;
}

export function getHnswFilterMode(): "soft" | "hard" {
  const v = (process.env.VECTORLITE_HNSW_FILTER_MODE ?? "soft").toLowerCase();
  return v === "soft" || v === "hard" ? (v as "soft" | "hard") : "soft";
}

export function getHnswSeeds(): "auto" | number {
  const v = (process.env.VECTORLITE_HNSW_SEEDS ?? "auto").toLowerCase();
  if (v === "auto") return "auto" as const;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : "auto";
}

export function getHnswBridge(): number {
  const v = Number(process.env.VECTORLITE_HNSW_BRIDGE ?? "32");
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 32;
}