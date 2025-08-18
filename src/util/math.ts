/** Math helpers for vector operations */

export function normalizeVectorInPlace(vec: Float32Array): void {
  let sum = 0
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i]
  }
  const inv = sum > 0 ? 1 / Math.sqrt(sum) : 1
  for (let i = 0; i < vec.length; i++) {
    vec[i] *= inv
  }
}

export function dotAt(data: Float32Array, base: number, q: Float32Array, dim: number): number {
  let s = 0
  for (let i = 0; i < dim; i++) {
    s += data[base + i] * q[i]
  }
  return s
}

export function l2negAt(data: Float32Array, base: number, q: Float32Array, dim: number): number {
  let s = 0
  for (let i = 0; i < dim; i++) {
    const d = data[base + i] - q[i]
    s += d * d
  }
  return -s
}

