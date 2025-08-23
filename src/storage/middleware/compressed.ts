/**
 * @file Compressed FileIO middleware using CompressionStream API
 */
import type { FileIO } from "../types";
import { toUint8 } from "../../util/bin";

export type CompressionFormat = "gzip" | "deflate" | "deflate-raw";

export type CompressedFileIOOptions = {
  format?: CompressionFormat;
};

// Helper to ensure we have an ArrayBuffer (not SharedArrayBuffer)
const toArrayBuffer = (data: Uint8Array): ArrayBuffer => {
  if (data.buffer instanceof ArrayBuffer) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  // If it's SharedArrayBuffer or other ArrayBufferLike, copy to new ArrayBuffer
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
};

/**
 * Creates a compressed FileIO middleware that wraps another FileIO implementation.
 * Uses the native CompressionStream and DecompressionStream APIs.
 *
 * @param baseFileIO - The underlying FileIO implementation to wrap
 * @param options - Compression options
 * @returns FileIO implementation with automatic compression/decompression
 */
export function createCompressedFileIO(baseFileIO: FileIO, options: CompressedFileIOOptions = {}): FileIO {
  const { format = "gzip" } = options;

  // Check if CompressionStream is available
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined") {
    throw new Error("CompressionStream API is not available in this environment");
  }

  const compress = async (data: Uint8Array): Promise<Uint8Array> => {
    const stream = new CompressionStream(format);
    const writer = stream.writable.getWriter();
    await writer.write(toArrayBuffer(data));
    await writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    // eslint-disable-next-line no-restricted-syntax -- Required for performance-critical buffer concatenation
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  };

  const decompress = async (data: Uint8Array): Promise<Uint8Array> => {
    const stream = new DecompressionStream(format);
    const writer = stream.writable.getWriter();
    await writer.write(toArrayBuffer(data));
    await writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    // eslint-disable-next-line no-restricted-syntax -- Required for performance-critical buffer concatenation
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  };

  const read = async (path: string): Promise<Uint8Array> => {
    const compressedData = await baseFileIO.read(path);
    return await decompress(compressedData);
  };

  const write = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    const uint8Data = toUint8(data);
    const compressedData = await compress(uint8Data);
    await baseFileIO.write(path, compressedData);
  };

  const append = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    // For append, we need to decompress existing data, append, and recompress
    const existingData = await read(path).catch(() => new Uint8Array(0));

    const newData = toUint8(data);
    const combined = new Uint8Array(existingData.length + newData.length);
    combined.set(existingData);
    combined.set(newData, existingData.length);

    await write(path, combined);
  };

  const atomicWrite = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    const uint8Data = toUint8(data);
    const compressedData = await compress(uint8Data);
    await baseFileIO.atomicWrite(path, compressedData);
  };

  const del = baseFileIO.del ? async (path: string): Promise<void> => { await baseFileIO.del!(path); } : undefined;

  return {
    read,
    write,
    append,
    atomicWrite,
    ...(del && { del }),
  };
}
