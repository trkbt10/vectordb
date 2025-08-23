/**
 * @file Cache API-backed FileIO implementation (Service Worker environments)
 */
import type { FileIO } from "./types";
import { toUint8 } from "../util/bin";

export type CacheStorageFileIOOptions = {
  cacheName: string;
  urlPrefix: string;
};

/**
 * Creates a FileIO implementation using the Cache API.
 * This is designed for Service Worker environments and enables offline-first scenarios.
 *
 * @param options - Configuration options (required)
 * @returns FileIO implementation backed by Cache Storage
 */
export function createCacheStorageFileIO(options: CacheStorageFileIOOptions): FileIO {
  const { cacheName, urlPrefix } = options;

  if (!cacheName) {
    throw new Error("cacheName is required");
  }

  if (!urlPrefix) {
    throw new Error("urlPrefix is required");
  }

  if (typeof caches === "undefined") {
    throw new Error("Cache API is not available in this environment");
  }

  const getCache = () => caches.open(cacheName);

  const pathToUrl = (path: string): string => {
    // Validate path to prevent injection attacks
    if (path.includes("..") || path.includes("//")) {
      throw new Error(`Invalid path: ${path}`);
    }
    // Use a proper URL format that Cache API expects
    return `${urlPrefix}/${cacheName}/${path}`;
  };

  const read = async (path: string): Promise<Uint8Array> => {
    const cache = await getCache();
    const url = pathToUrl(path);
    const response = await cache.match(url);

    if (!response) {
      throw new Error(`File not found: ${path}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  };

  const write = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    const cache = await getCache();
    const url = pathToUrl(path);
    const uint8 = toUint8(data);

    const buf = new ArrayBuffer(uint8.byteLength);
    new Uint8Array(buf).set(uint8);
    const response = new Response(new Blob([buf]), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(uint8.length),
      },
    });

    await cache.put(url, response);
  };

  const append = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    const cache = await getCache();
    const url = pathToUrl(path);

    // Read existing data
    const existingResponse = await cache.match(url);
    const existingData = existingResponse ? new Uint8Array(await existingResponse.arrayBuffer()) : new Uint8Array(0);

    // Append new data
    const newData = toUint8(data);
    const combined = new Uint8Array(existingData.length + newData.length);
    combined.set(existingData);
    combined.set(newData, existingData.length);

    // Write combined data
    await write(path, combined);
  };

  const atomicWrite = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    // Cache API put operation is inherently atomic
    await write(path, data);
  };

  const del = async (path: string): Promise<void> => {
    const cache = await getCache();
    const url = pathToUrl(path);
    const deleted = await cache.delete(url);

    if (!deleted) {
      throw new Error(`File not found: ${path}`);
    }
  };

  return {
    read,
    write,
    append,
    atomicWrite,
    del,
  };
}
