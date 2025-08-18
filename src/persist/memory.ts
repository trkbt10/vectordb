/**
 * In-memory FileIO implementation for tests and demos.
 *
 * Why: Provide a zero-dependency, side-effect-free FileIO for unit tests and
 * simple scenarios without touching the filesystem.
 */
import type { FileIO } from './types'
import { toUint8 } from './types'

export function createMemoryFileIO(initial?: Record<string, Uint8Array | ArrayBuffer>): FileIO {
  const store = new Map<string, Uint8Array>()
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      store.set(k, toUint8(v))
    }
  }
  return {
    async read(path: string): Promise<Uint8Array> {
      const v = store.get(path)
      if (!v) throw new Error(`file not found: ${path}`)
      return new Uint8Array(v) // return a copy
    },
    async write(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      store.set(path, toUint8(data))
    },
    async append(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const prev = store.get(path)
      const next = toUint8(data)
      if (!prev) {
        store.set(path, next)
        return
      }
      const merged = new Uint8Array(prev.length + next.length)
      merged.set(prev, 0)
      merged.set(next, prev.length)
      store.set(path, merged)
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      // Atomic within single-threaded JS: replace reference
      store.set(path, toUint8(data))
    },
  }
}
