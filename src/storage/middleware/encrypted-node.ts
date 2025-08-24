/**
 * @file Node.js-specific encrypted FileIO implementation
 */
import { webcrypto } from "node:crypto";
import type { FileIO } from "../types";
import { createEncryptedFileIO as createEncryptedFileIOBase } from "./encrypted";
import type { EncryptedFileIOOptions } from "./encrypted";

/**
 * Node.js-specific entry point for encrypted FileIO.
 * Automatically provides the webcrypto implementation from node:crypto.
 *
 * @param baseFileIO - The underlying FileIO implementation to wrap
 * @param encryptionKey - 32-byte encryption key (or string to derive key from)
 * @returns FileIO implementation with automatic encryption/decryption
 */
export async function createEncryptedFileIO(
  baseFileIO: FileIO,
  encryptionKey: Uint8Array | string,
  options: Omit<EncryptedFileIOOptions, "crypto"> = {},
): Promise<FileIO> {
  return createEncryptedFileIOBase(baseFileIO, encryptionKey, {
    crypto: webcrypto as Crypto,
    ...options,
  });
}
