/**
 * @file Browser OPFS storage adapter
 * Why: minimal helpers around OPFS to avoid repetitive boilerplate.
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
  const storage = (x as Record<string, unknown> | undefined)?.storage;
  return !!storage && typeof (storage as { getDirectory?: unknown }).getDirectory === "function";
}

function requireRoot(): Promise<OPFSDirectory> {
  const nav: unknown = (globalThis as { navigator?: unknown }).navigator;
  if (!hasOPFSNavigator(nav)) throw new Error("OPFS not available in this environment");
  return (nav as NavigatorWithOPFS).storage.getDirectory();
}

async function readBytes(fileName: string): Promise<Uint8Array> {
  const root = await requireRoot();
  const fh = await root.getFileHandle(fileName);
  const file = await fh.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function writeBytes(fileName: string, data: Uint8Array | ArrayBuffer, keepExistingData: boolean): Promise<void> {
  const root = await requireRoot();
  const fh = await root.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable({ keepExistingData });
  await w.write(toUint8(data));
  await w.close();
}

/** Create a FileIO backed by OPFS. */
export function createOPFSFileIO(): FileIO {
  return {
    async read(path: string): Promise<Uint8Array> {
      return await readBytes(path);
    },
    async write(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      await writeBytes(path, data, false);
    },
    async append(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      await writeBytes(path, data, true);
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      await writeBytes(path, data, false);
    },
    async del(): Promise<void> {
      // not implemented
    },
  };
}
