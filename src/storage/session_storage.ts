/**
 * @file Browser sessionStorage-backed FileIO
 */
import type { FileIO } from "./types";
import { toUint8 } from "./types";

function requireSession(): Storage {
  const s = (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage;
  if (!s || typeof s.getItem !== "function") {
    throw new Error("sessionStorage not available");
  }
  return s;
}

function encodeBase64(u8: Uint8Array): string {
  const binary = Array.from(u8, (v) => String.fromCharCode(v)).join("");
  return btoa(binary);
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i) & 0xff;
  }
  return out;
}

/**
 * Create a FileIO backed by sessionStorage.
 *
 * @returns A FileIO implementation using sessionStorage for persistence.
 */
export function createSessionStorageFileIO(): FileIO {
  const storage = requireSession();
  return {
    async read(path: string): Promise<Uint8Array> {
      const v = storage.getItem(path);
      if (v == null) {
        throw new Error(`file not found: ${path}`);
      }
      return decodeBase64(v);
    },
    async write(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      storage.setItem(path, encodeBase64(toUint8(data)));
    },
    async append(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const prev = storage.getItem(path);
      if (prev == null) {
        storage.setItem(path, encodeBase64(toUint8(data)));
        return;
      }
      const a = decodeBase64(prev);
      const b = toUint8(data);
      const merged = new Uint8Array(a.length + b.length);
      merged.set(a, 0);
      merged.set(b, a.length);
      storage.setItem(path, encodeBase64(merged));
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      storage.setItem(path, encodeBase64(toUint8(data)));
    },
    async del(path: string): Promise<void> {
      storage.removeItem(path);
    },
  };
}
