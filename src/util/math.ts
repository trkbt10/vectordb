/**
 * Math helpers for similarity/distance and normalization.
 *
 * @file Centralize hot-path math kernels (dot, L2 negative distance, cosine
 * normalization) so strategies can share optimized implementations.
 */

/**
 *
 */
export function normalizeVectorInPlace(vec: Float32Array): void {
  // eslint-disable-next-line -- high performance
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }

  const inv = sum > 0 ? 1 / Math.sqrt(sum) : 1;
  for (let i = 0; i < vec.length; i++) {
    vec[i] *= inv;
  }
}

/**
 *
 */
export function dotAt(data: Float32Array, base: number, q: Float32Array, dim: number): number {
  // eslint-disable-next-line -- high performance
  let s = 0;
  for (let i = 0; i < dim; i++) {
    s += data[base + i] * q[i];
  }

  return s;
}

/**
 *
 */
export function l2negAt(data: Float32Array, base: number, q: Float32Array, dim: number): number {
  // eslint-disable-next-line -- high performance
  let s = 0;
  for (let i = 0; i < dim; i++) {
    const d = data[base + i] - q[i];
    s += d * d;
  }
  return -s;
}
