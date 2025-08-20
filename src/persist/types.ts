/**
 * @file File I/O abstraction layer for persistence operations
 *
 * This module defines the interface for file system operations across different
 * environments (Node.js, browser with OPFS, in-memory). It provides:
 * - A unified FileIO interface for read/write operations
 * - Support for atomic writes to ensure data integrity
 * - Append operations for write-ahead logging (WAL)
 * - Type conversions between ArrayBuffer and Uint8Array
 *
 * The abstraction allows VectorDB to work seamlessly across environments
 * while maintaining consistent persistence semantics and enabling features
 * like crash recovery and transactional guarantees.
 */

export type FileIO = {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  append(path: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  del?(path: string): Promise<void>;
};

/**
 *
 */
export function toUint8(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

// Convenience re-export for external callers that conceptually expect a blob store
export type { FileIO as BloblikeIO };
