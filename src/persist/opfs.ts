// Browser OPFS (Origin Private File System) helpers
import type { FileIO } from './types'
import { toUint8 } from './types'

type FileWritable = { write(data: Uint8Array): Promise<void>; close(): Promise<void> }
type FileHandleWritable = { createWritable(): Promise<FileWritable> }
type FileHandleReadable = { getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> }
type FileHandle = FileHandleWritable & FileHandleReadable
type OPFSDirectory = { getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle> }
type NavigatorWithOPFS = { storage: { getDirectory(): Promise<OPFSDirectory> } }

function hasOPFSNavigator(x: unknown): x is NavigatorWithOPFS {
  if (!x || typeof x !== 'object') return false
  const storage = (x as Record<string, unknown>).storage
  if (!storage || typeof storage !== 'object') return false
  const maybe = storage as { getDirectory?: unknown }
  return typeof maybe.getDirectory === 'function'
}

export async function saveToOPFS(buf: ArrayBuffer, fileName = 'vectordb.vlite') {
  const nav: unknown = (globalThis as { navigator?: unknown }).navigator
  if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
  const root = await nav.storage.getDirectory()
  const handle = await root.getFileHandle(fileName, { create: true })
  const w = await handle.createWritable()
  await w.write(new Uint8Array(buf))
  await w.close()
}

export async function loadFromOPFS(fileName = 'vectordb.vlite'): Promise<ArrayBuffer> {
  const nav: unknown = (globalThis as { navigator?: unknown }).navigator
  if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
  const root = await nav.storage.getDirectory()
  const handle = await root.getFileHandle(fileName)
  const file = await handle.getFile()
  return await file.arrayBuffer()
}

/** Save WAL fully to OPFS (overwrite). */
export async function saveWalToOPFS(buf: Uint8Array, fileName = 'vectordb.vlite.wal') {
  const nav: unknown = (globalThis as { navigator?: unknown }).navigator
  if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
  const root = await nav.storage.getDirectory()
  const handle = await root.getFileHandle(fileName, { create: true })
  const w = await handle.createWritable()
  await w.write(buf)
  await w.close()
}

/** Load WAL from OPFS; returns empty if not found. */
export async function loadWalFromOPFS(fileName = 'vectordb.vlite.wal'): Promise<Uint8Array> {
  const nav: unknown = (globalThis as { navigator?: unknown }).navigator
  if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
  const root = await nav.storage.getDirectory()
  const handle = await root.getFileHandle(fileName, { create: false }).catch(() => null as any)
  if (!handle) return new Uint8Array()
  const file = await handle.getFile()
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

/** Create a FileIO backed by OPFS. 'path' is treated as a file name. */
export function createOPFSFileIO(): FileIO {
  return {
    async read(fileName: string) {
      const nav: unknown = (globalThis as { navigator?: unknown }).navigator
      if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
      const root = await nav.storage.getDirectory()
      const handle = await root.getFileHandle(fileName)
      const file = await handle.getFile()
      const buf = await file.arrayBuffer()
      return new Uint8Array(buf)
    },
    async write(fileName: string, data) {
      const nav: unknown = (globalThis as { navigator?: unknown }).navigator
      if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
      const root = await nav.storage.getDirectory()
      const handle = await root.getFileHandle(fileName, { create: true })
      const w = await handle.createWritable()
      await w.write(toUint8(data))
      await w.close()
    },
    async append(fileName: string, data) {
      // Try keepExistingData if supported, otherwise read+concat+write
      const nav: unknown = (globalThis as { navigator?: unknown }).navigator
      if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
      const root = await nav.storage.getDirectory()
      const handle = await root.getFileHandle(fileName, { create: true })
      const anyHandle = handle as unknown as { createWritable: (opts?: { keepExistingData?: boolean }) => Promise<FileWritable> }
      try {
        const w = await anyHandle.createWritable({ keepExistingData: true })
        await w.write(toUint8(data))
        await w.close()
      } catch {
        // Fallback: manual append
        const file = await handle.getFile()
        const prev = new Uint8Array(await file.arrayBuffer())
        const nextData = toUint8(data)
        const merged = new Uint8Array(prev.length + nextData.length)
        merged.set(prev, 0); merged.set(nextData, prev.length)
        const w = await handle.createWritable()
        await w.write(merged)
        await w.close()
      }
    },
    async atomicWrite(fileName: string, data) {
      // OPFS createWritable is atomic on close
      const nav: unknown = (globalThis as { navigator?: unknown }).navigator
      if (!hasOPFSNavigator(nav)) throw new Error('OPFS not available in this environment')
      const root = await nav.storage.getDirectory()
      const handle = await root.getFileHandle(fileName, { create: true })
      const w = await handle.createWritable()
      await w.write(toUint8(data))
      await w.close()
    },
  }
}
