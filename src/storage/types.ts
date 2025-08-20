/**
 * @file File I/O abstraction layer
 * Why: unify read/write/append/atomic operations across backends.
 */
export type FileIO = {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  append(path: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  del?(path: string): Promise<void>;
};

/** Convert ArrayBuffer to Uint8Array (no-copy when possible). */
export function toUint8(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export type { FileIO as BloblikeIO };
