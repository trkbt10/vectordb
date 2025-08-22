/**
 * @file Small helpers for the HTTP server
 */
import type { AppConfig } from "./types";

export type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Normalize unknown to number[] when possible, else null. */
export function toNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) {
    return null;
  }
  if (v.every((x) => typeof x === "number")) {
    return v as number[];
  }
  return null;
}

/** Ensure vector is a Float32Array. */
export function normalizeVector(vec: number[] | Float32Array): Float32Array {
  return vec instanceof Float32Array ? vec : new Float32Array(vec);
}

/** Shallow-redact secrets from config for safe exposure. */
export function redactConfig(cfg: AppConfig): AppConfig {
  const copy: AppConfig = JSON.parse(JSON.stringify(cfg ?? {}));
  if (copy.server?.embeddings?.apiKey) {
    copy.server.embeddings.apiKey = "[redacted]";
  }
  return copy;
}

export type ParsedVectorBody = { id: number; vector: number[]; meta?: Record<string, unknown> | null };
export type ParsedBulkBody = { rows: ParsedVectorBody[] };

/**
 * Validate a single vector row payload.
 * @param x arbitrary JSON
 * @returns parsed body or null if invalid
 */
export function parseVectorBody(x: unknown): ParsedVectorBody | null {
  if (!x || typeof x !== "object") {
    return null;
  }
  const obj = x as Record<string, unknown>;
  const id = Number(obj.id);
  const vec = toNumberArray(obj.vector);
  if (!Number.isFinite(id) || !vec) {
    return null;
  }
  const meta = (obj.meta ?? null) as Record<string, unknown> | null;
  return { id, vector: vec, meta };
}

/**
 * Validate a bulk vector payload `{ rows: [...] }`.
 * @param x arbitrary JSON
 * @returns parsed body or null if invalid
 */
export function parseBulkBody(x: unknown): ParsedBulkBody | null {
  if (!x || typeof x !== "object") {
    return null;
  }
  const obj = x as Record<string, unknown>;
  const rows = Array.isArray(obj.rows) ? obj.rows : null;
  if (!rows) {
    return null;
  }
  const parsed: ParsedVectorBody[] = [];
  for (const r of rows) {
    const v = parseVectorBody(r);
    if (!v) {
      return null;
    }
    parsed.push(v);
  }
  return { rows: parsed };
}
