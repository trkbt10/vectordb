/**
 * @file Encrypted FileIO middleware using Web Crypto API
 */
import type { FileIO } from "../types";
import { toUint8 } from "../../util/bin";

export type EncryptedFileIOOptions = {
  crypto?: Crypto;
  pbkdf2?: {
    // Salt used for key derivation when a string password is provided.
    // Provide as bytes or a UTF-8 string. Required for string keys.
    salt: Uint8Array | string;
    // Iteration count; default 310000 per modern guidance.
    iterations?: number;
    // Hash algorithm for PBKDF2; default 'SHA-256'.
    hash?: "SHA-256" | "SHA-384" | "SHA-512";
  };
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
 * Creates an encrypted FileIO middleware using Web Crypto API.
 * Uses AES-GCM encryption with 256-bit keys.
 *
 * @param baseFileIO - The underlying FileIO implementation to wrap
 * @param encryptionKey - 32-byte encryption key (or string to derive key from)
 * @param options - Optional crypto implementation
 * @returns FileIO implementation with automatic encryption/decryption
 */
export async function createEncryptedFileIO(
  baseFileIO: FileIO,
  encryptionKey: Uint8Array | string,
  options: EncryptedFileIOOptions = {},
): Promise<FileIO> {
  const crypto = options.crypto || globalThis.crypto;

  if (!crypto || !crypto.subtle) {
    throw new Error("Web Crypto API is not available");
  }

  // Derive or import the key
  const cryptoKey = await (async () => {
    if (typeof encryptionKey === "string") {
      // Derive key from string using PBKDF2
      if (!options.pbkdf2 || options.pbkdf2.salt === undefined) {
        throw new Error("PBKDF2 salt must be provided in options.pbkdf2 when using a string encryptionKey");
      }
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(encryptionKey), "PBKDF2", false, [
        "deriveBits",
        "deriveKey",
      ]);

      // Resolve salt bytes from options with proper ArrayBuffer backing
      const saltBytes = new Uint8Array(
        toArrayBuffer(
          (() => {
            const s = options.pbkdf2!.salt;
            if (typeof s === "string") {
              return new TextEncoder().encode(s);
            }
            return s;
          })(),
        ),
      );

      const iterations = options.pbkdf2?.iterations ?? 310_000;
      const hash = options.pbkdf2?.hash ?? "SHA-256";

      return await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: saltBytes,
          iterations,
          hash,
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    }
    // Import raw key bytes
    if (encryptionKey.length !== 32) {
      throw new Error("Encryption key must be 32 bytes for AES-256");
    }
    return await crypto.subtle.importKey("raw", toArrayBuffer(encryptionKey), { name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
  })();

  const encrypt = async (data: Uint8Array): Promise<Uint8Array> => {
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, toArrayBuffer(data));

    // Prepend IV to the encrypted data
    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encryptedData), iv.length);

    return result;
  };

  const decrypt = async (data: Uint8Array): Promise<Uint8Array> => {
    if (data.length < 12) {
      throw new Error("Invalid encrypted data: too short");
    }

    // Extract IV from the beginning
    const iv = data.slice(0, 12);
    const encryptedData = data.slice(12);

    const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encryptedData);

    return new Uint8Array(decryptedData);
  };

  const read = async (path: string): Promise<Uint8Array> => {
    const encryptedData = await baseFileIO.read(path);
    return await decrypt(encryptedData);
  };

  const write = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    const uint8Data = toUint8(data);
    const encryptedData = await encrypt(uint8Data);
    await baseFileIO.write(path, encryptedData);
  };

  const append = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    // For append, we need to decrypt existing data, append, and re-encrypt
    const existingData = await read(path).catch(() => new Uint8Array(0));

    const newData = toUint8(data);
    const combined = new Uint8Array(existingData.length + newData.length);
    combined.set(existingData);
    combined.set(newData, existingData.length);

    await write(path, combined);
  };

  const atomicWrite = async (path: string, data: Uint8Array | ArrayBuffer): Promise<void> => {
    const uint8Data = toUint8(data);
    const encryptedData = await encrypt(uint8Data);
    await baseFileIO.atomicWrite(path, encryptedData);
  };

  const base = { read, write, append, atomicWrite } as FileIO;
  if (baseFileIO.del) {
    const del = async (p: string): Promise<void> => {
      await baseFileIO.del!(p);
    };
    return { ...base, del };
  }
  return base;
}
