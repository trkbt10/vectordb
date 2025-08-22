/**
 * @file Simple CRC32 checksum for WAL utilities (optional use)
 */
export function crc32(u8: Uint8Array): number {
  // eslint-disable-next-line no-restricted-syntax -- local mutable accumulator for performance
  let c = ~0 >>> 0;
  for (let i = 0; i < u8.length; i++) {
    c ^= u8[i] as number;
    for (let k = 0; k < 8; k++) {
      const mask = -(c & 1);
      c = (c >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (~c) >>> 0;
}
