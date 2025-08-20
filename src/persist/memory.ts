/**
 * @file In-memory file system implementation for testing and development
 *
 * This module provides a fully in-memory implementation of the FileIO interface,
 * enabling VectorDB to run without any file system dependencies. Features:
 * - Complete FileIO compatibility for seamless testing
 * - Isolated storage that doesn't affect the real file system
 * - Support for pre-populating files for test scenarios
 * - Atomic write simulation for testing transactional behavior
 *
 * Primarily used for unit tests, browser demos, and development environments
 * where file system access is unavailable or undesirable. The implementation
 * maintains the same semantics as real file operations, including proper
 * error handling for missing files.
 */
import type { FileIO } from "./types";
import { toUint8 } from "./types";

/**
 *
 */
export function createMemoryFileIO(initial?: Record<string, Uint8Array | ArrayBuffer>): FileIO {
  const store = new Map<string, Uint8Array>();
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      store.set(k, toUint8(v));
    }
  }
  return {
    async read(path: string): Promise<Uint8Array> {
      const v = store.get(path);
      if (!v) throw new Error(`file not found: ${path}`);
      return new Uint8Array(v); // return a copy
    },
    async write(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      store.set(path, toUint8(data));
    },
    async append(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const prev = store.get(path);
      const next = toUint8(data);
      if (!prev) {
        store.set(path, next);
        return;
      }
      const merged = new Uint8Array(prev.length + next.length);
      merged.set(prev, 0);
      merged.set(next, prev.length);
      store.set(path, merged);
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      // Atomic within single-threaded JS: replace reference
      store.set(path, toUint8(data));
    },
    async del(path: string): Promise<void> {
      store.delete(path);
    },
  };
}
