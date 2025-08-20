/**
 * @file Browser OPFS storage adapter
 */
import type { FileIO } from "./types";
import { toUint8 } from "./types";

type FileWritable = { write(data: Uint8Array): Promise<void>; close(): Promise<void> };
type FileHandleWritable = { createWritable(options?: { keepExistingData?: boolean }): Promise<FileWritable> };
type FileHandleReadable = { getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> };
type FileHandle = FileHandleWritable & FileHandleReadable;
type OPFSDirectory = { getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle> };
type NavigatorWithOPFS = { storage: { getDirectory(): Promise<OPFSDirectory> } };

function hasOPFSNavigator(x: unknown): x is NavigatorWithOPFS {
  if (!x || typeof x !== "object") return false;
  const storage = (x as Record<string, unknown>).storage;
  if (!storage || typeof storage !== "object") return false;
  const maybe = storage as { getDirectory?: unknown };
  return typeof maybe.getDirectory === "function";
}

function requireOPFSNavigator(): NavigatorWithOPFS {
  const nav: unknown = (globalThis as { navigator?: unknown }).navigator;
  if (!hasOPFSNavigator(nav)) throw new Error("OPFS not available in this environment");
  return nav;
}

/**
 * Save a full snapshot into OPFS.
 * Why: provide a browser-native persistence path without server roundtrips.
 */
export async function saveToOPFS(buf: ArrayBuffer, fileName = "vectordb.vlite") {
  const nav = requireOPFSNavigator();
  const root = await nav.storage.getDirectory();
  const handle = await root.getFileHandle(fileName, { create: true });
  const w = await handle.createWritable();
  await w.write(new Uint8Array(buf));
  await w.close();
}

/**
 * Load a full snapshot from OPFS.
 * Why: open persisted state in browser environments.
 */
export async function loadFromOPFS(fileName = "vectordb.vlite"): Promise<ArrayBuffer> {
  const nav = requireOPFSNavigator();
  const root = await nav.storage.getDirectory();
  const handle = await root.getFileHandle(fileName);
  const file = await handle.getFile();
  return await file.arrayBuffer();
}

/** Save WAL content to OPFS (overwrite). */
export async function saveWalToOPFS(buf: Uint8Array, fileName = "vectordb.vlite.wal") {
  const nav = requireOPFSNavigator();
  const root = await nav.storage.getDirectory();
  const handle = await root.getFileHandle(fileName, { create: true });
  const w = await handle.createWritable({ keepExistingData: false });
  await w.write(buf);
  await w.close();
}

/** Append WAL content in OPFS (keep existing). */
export async function appendWalToOPFS(buf: Uint8Array, fileName = "vectordb.vlite.wal") {
  const nav = requireOPFSNavigator();
  const root = await nav.storage.getDirectory();
  const handle = await root.getFileHandle(fileName, { create: true });
  const w = await handle.createWritable({ keepExistingData: true });
  await w.write(toUint8(buf));
  await w.close();
}

/**
 * Create a FileIO backed by OPFS.
 * Why: reuse the same interface across Node and browser.
 */
export function createOPFSFileIO(): FileIO {
  return {
    async read(path: string): Promise<Uint8Array> {
      const nav = requireOPFSNavigator();
      const root = await nav.storage.getDirectory();
      const fh = await root.getFileHandle(path);
      const file = await fh.getFile();
      const buf = await file.arrayBuffer();
      return new Uint8Array(buf);
    },
    async write(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const nav = requireOPFSNavigator();
      const root = await nav.storage.getDirectory();
      const fh = await root.getFileHandle(path, { create: true });
      const w = await fh.createWritable({ keepExistingData: false });
      await w.write(toUint8(data));
      await w.close();
    },
    async append(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const nav = requireOPFSNavigator();
      const root = await nav.storage.getDirectory();
      const fh = await root.getFileHandle(path, { create: true });
      const w = await fh.createWritable({ keepExistingData: true });
      await w.write(toUint8(data));
      await w.close();
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      await this.write(path, data);
    },
    async del(): Promise<void> {
      // not implemented
    },
  };
}
