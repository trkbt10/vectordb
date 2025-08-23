/**
 * @file WAL module façade
 */
export { encodeWal, decodeWal, applyWal, applyWalWithIndex, verifyWal } from "./format";
export type { WalRecord } from "./format";
export { createWalRuntime } from "./runtime";
export type { WalRuntime } from "./runtime";
export { crc32, addWalChecksum, readWalChecksum } from "./checksum";
export {
  WalTooShortError,
  WalHeaderTruncatedError,
  WalBadMagicError,
  WalUnsupportedVersionError,
  WalTruncatedRecordError,
  WalDecodeError,
} from "./errors";
