/**
 * @file Lightweight embedding helpers for Search input
 *
 * This module converts a free-form query into a Float32Array vector suitable for
 * vector search. It supports two paths:
 * - Direct vector input: comma/space区切りの数値列をそのまま使用
 * - 文字列入力: 簡易ハッシュ埋め込みで dim 次元ベクトルに投影
 */

/** Try to parse a vector from a string. Accepts comma or whitespace separated numbers. */
export function parseQueryVector(q: string, dim: number): Float32Array | null {
  const trimmed = q.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const nums = parts.map((s) => Number(s)).filter((n) => !Number.isNaN(n));
  if (nums.length !== parts.length) {
    return null;
  }
  if (nums.length !== dim) {
    return null;
  }
  return Float32Array.from(nums);
}

function hash32(s: string): number {
  // FNV-1a style hash; deterministic per token
  const prime = 16777619 >>> 0;
  const init = 2166136261 >>> 0;
  const step = (acc: number, code: number) => {
    const x = (acc ^ code) >>> 0;
    return Math.imul(x, prime) >>> 0;
  };
  const codes = Array.from(s).map((ch) => ch.codePointAt(0) ?? 0);
  const folded = codes.reduce((acc, c) => step(acc, c), init);
  return folded & 0x7fffffff;
}

/**
 * Compute a simple hashing-based embedding for a text.
 * Each token contributes +1 to a hashed index (feature hashing). No external model required.
 */
export function hashEmbed(text: string, dim: number): Float32Array {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const bump = (dst: Float32Array, token: string): Float32Array => {
    const idx = hash32(token) % dim;
    const next = new Float32Array(dst);
    next[idx] = next[idx] + 1;
    return next;
  };
  const fold = (arr: string[]): Float32Array => {
    if (arr.length === 0) {
      return new Float32Array(dim);
    }
    const head = arr[arr.length - 1] as string;
    const init = fold(arr.slice(0, arr.length - 1));
    return bump(init, head);
  };
  return fold(tokens);
}

/** Convert query → vector: prefer numeric vector, else fallback to hash embedding. */
export function queryToVector(q: string, dim: number): Float32Array | null {
  const direct = parseQueryVector(q, dim);
  if (direct) {
    return direct;
  }
  if (!q.trim()) {
    return null;
  }
  return hashEmbed(q, dim);
}

// OpenAI embeddings (optional): keep in debug include path
import { embedOpenAI } from "../../../../../../debug/scenarios/embeddings-openai/openai-service";

/** Try embedding via OpenAI; returns null when unavailable or on error. */
export async function queryToVectorOpenAI(q: string, dim: number): Promise<Float32Array | null> {
  const key = process.env.OPENAI_API_KEY as string | undefined;
  if (!q.trim()) {
    return null;
  }
  if (!key) {
    return null;
  }
  try {
    const [arr] = await embedOpenAI([q], key);
    const u = new Float32Array(arr);
    if (u.length === dim) {
      return u;
    }
    if (u.length > dim) {
      return u.slice(0, dim);
    }
    const out = new Float32Array(dim);
    out.set(u, 0);
    return out;
  } catch {
    return null;
  }
}
