/**
 * Enum codec helper for string unions.
 *
 * Why: Provide a single, type-safe way to map discriminated string unions to
 * numeric codes for binary formats, with duplicate-code validation and
 * exhaustive typing via Record<K, number>.
 */

export type EnumCodec<K extends string> = {
  codes: Record<K, number>
  encode: (k: K) => number
  decode: (code: number) => K
}

/**
 *
 */
export function createEnumCodec<K extends string>(codes: Record<K, number>): EnumCodec<K> {
  const rev = new Map<number, K>()
  for (const [k, v] of Object.entries(codes) as [K, number][]) {
    if (rev.has(v)) throw new Error(`duplicate code ${v} for ${String(k)} and ${String(rev.get(v))}`)
    rev.set(v, k)
  }
  return {
    codes,
    encode: (k: K) => codes[k],
    decode: (code: number) => {
      const k = rev.get(code)
      if (!k) throw new Error(`unsupported code ${code}`)
      return k
    },
  }
}

