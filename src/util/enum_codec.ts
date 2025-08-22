/**
 * @file Type-safe enum codec for binary serialization
 *
 * This module provides a bidirectional mapping system between TypeScript string
 * literal types and numeric codes for efficient binary serialization. Features:
 * - Type-safe encoding/decoding of string enums to numeric values
 * - Compile-time exhaustiveness checking via TypeScript's type system
 * - Runtime validation to prevent duplicate code assignments
 * - Consistent error handling for invalid codes
 *
 * Used throughout the system to serialize discriminated unions (like Metric and
 * Strategy types) in a way that's both space-efficient and maintains type safety
 * during deserialization.
 */

export type EnumCodec<K extends string> = {
  codes: Record<K, number>;
  encode: (k: K) => number;
  decode: (code: number) => K;
};

/**
 *
 */
export function createEnumCodec<K extends string>(codes: Record<K, number>): EnumCodec<K> {
  const rev = new Map<number, K>();
  for (const [k, v] of Object.entries(codes) as [K, number][]) {
    if (rev.has(v)) {
      throw new Error(`duplicate code ${v} for ${String(k)} and ${String(rev.get(v))}`);
    }
    rev.set(v, k);
  }
  return {
    codes,
    encode: (k: K) => codes[k],
    decode: (code: number) => {
      const k = rev.get(code);
      if (!k) {
        throw new Error(`unsupported code ${code}`);
      }
      return k;
    },
  };
}
