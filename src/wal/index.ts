/**
 * @file WAL module façade
 */
export { encodeWal, decodeWal, applyWal, applyWalWithIndex } from "./format";
export type { WalRecord } from "./format";
export { createWalRuntime } from "./runtime";
export type { WalRuntime } from "./runtime";
export { crc32 } from "./checksum";
export * from "./errors";
