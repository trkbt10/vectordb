// Node.js persistence helpers
import { writeFile, readFile, rename } from 'node:fs/promises'
import type { FileIO } from './types'
import { toUint8 } from './types'

export async function saveToFileNode(buf: ArrayBuffer, path: string) {
  await writeFile(path, new Uint8Array(buf))
}

export async function loadFromFileNode(path: string): Promise<ArrayBuffer> {
  const u8 = await readFile(path)
  const out = new Uint8Array(u8.byteLength)
  out.set(u8)
  return out.buffer
}

/** Append data to a file (WAL) via append flag. */
export async function appendToFileNode(buf: Uint8Array, path: string): Promise<void> {
  await writeFile(path, buf, { flag: 'a' as unknown as undefined })
}

/** Atomic snapshot: write to temp file and rename over destination. */
export async function saveAtomicToFileNode(buf: ArrayBuffer, path: string): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, new Uint8Array(buf))
  await rename(tmp, path)
}

export function createNodeFileIO(): FileIO {
  return {
    async read(path: string) { const u8 = await readFile(path); const out = new Uint8Array(u8.byteLength); out.set(u8); return out },
    async write(path: string, data) { await writeFile(path, toUint8(data)) },
    async append(path: string, data) { await writeFile(path, toUint8(data), { flag: 'a' as unknown as undefined }) },
    async atomicWrite(path: string, data) { const tmp = `${path}.tmp`; await writeFile(tmp, toUint8(data)); await rename(tmp, path) },
  }
}
