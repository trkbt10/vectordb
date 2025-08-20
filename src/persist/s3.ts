/**
 * @file S3 persistence adapter (presigned URL based)
 *
 * This adapter implements the FileIO interface by performing HTTP
 * requests against presigned S3 URLs. It works in both browser and
 * server runtimes as long as `fetch` is available.
 *
 * Design goals:
 * - No hard dependency on AWS SDKs (caller provides URLs)
 * - Simple mapping of FileIO ops to S3 object keys
 * - Safe fallbacks for append (read+concat+write)
 *
 * Usage:
 * const io = createS3FileIO({
 *   resolveReadUrl: (key) => `/api/s3/read?key=${encodeURIComponent(key)}`,
 *   resolveWriteUrl: (key) => `/api/s3/write?key=${encodeURIComponent(key)}`,
 *   resolveDeleteUrl: (key) => `/api/s3/delete?key=${encodeURIComponent(key)}`,
 * });
 *
 * The backing endpoints should return presigned URLs or proxy the request
 * to S3 with proper authentication and headers.
 */
import type { FileIO } from "./types";
import { toUint8 } from "./types";

export type PresignedS3IOOptions = {
  /** Resolve a URL that returns object bytes (HTTP GET). */
  resolveReadUrl: (key: string) => Promise<string> | string;
  /** Resolve a URL that accepts object bytes (HTTP PUT). */
  resolveWriteUrl: (key: string) => Promise<string> | string;
  /** Resolve a URL for deletion (HTTP DELETE). Optional. */
  resolveDeleteUrl?: (key: string) => Promise<string> | string;
  /** Optional headers or header-factory per operation. */
  headers?:
    | Record<string, string>
    | ((op: "read" | "write" | "delete", key: string) => HeadersInit);
};

function resolveHeaders(
  opts: PresignedS3IOOptions,
  op: "read" | "write" | "delete",
  key: string,
): HeadersInit | undefined {
  if (!opts.headers) return undefined;
  return typeof opts.headers === "function" ? opts.headers(op, key) : opts.headers;
}

async function toUrl(src: string | Promise<string>): Promise<string> {
  return typeof src === "string" ? src : await src;
}

/** Create a FileIO backed by S3 via presigned URLs or proxy endpoints. */
export function createS3FileIO(opts: PresignedS3IOOptions): FileIO {
  return {
    async read(key: string): Promise<Uint8Array> {
      const url = await toUrl(opts.resolveReadUrl(key));
      const res = await fetch(url, { method: "GET", headers: resolveHeaders(opts, "read", key) });
      if (!res.ok) throw new Error(`S3 read failed for ${key}: ${res.status} ${res.statusText}`);
      const buf: ArrayBuffer = await res.arrayBuffer();
      return new Uint8Array(buf) as unknown as Uint8Array;
    },
    async write(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const url = await toUrl(opts.resolveWriteUrl(key));
      const bytes = toUint8(data);
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const res = await fetch(url, {
        method: "PUT",
        body: ab,
        headers: resolveHeaders(opts, "write", key),
      });
      if (!res.ok) throw new Error(`S3 write failed for ${key}: ${res.status} ${res.statusText}`);
    },
    async append(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      // S3 has no native append; emulate with read+concat+write
      let prev = new Uint8Array();
      try {
        prev = new Uint8Array(await this.read(key));
      } catch {
        // treat as new object if not found or read fails
      }
      const next = toUint8(data);
      const merged = new Uint8Array(prev.length + next.length);
      merged.set(prev, 0);
      merged.set(next, prev.length);
      await this.write(key, merged);
    },
    async atomicWrite(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      // PUT to S3 is atomic for the object key (last writer wins semantics)
      await this.write(key, data);
    },
    async del(key: string): Promise<void> {
      if (!opts.resolveDeleteUrl) return; // optional
      const url = await toUrl(opts.resolveDeleteUrl(key));
      const res = await fetch(url, { method: "DELETE", headers: resolveHeaders(opts, "delete", key) });
      if (!res.ok) throw new Error(`S3 delete failed for ${key}: ${res.status} ${res.statusText}`);
    },
  };
}
