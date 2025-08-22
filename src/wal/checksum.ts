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

// Footer magic 'WCRC' in little-endian
const WCRC_MAGIC = 0x57435243; // 'WCRC'

/**
 * Append a simple footer checksum. Format: 4-byte magic 'WCRC' + 4-byte CRC32 (little-endian).
 */
export function addWalChecksum(u8: Uint8Array): Uint8Array {
  const footer = new Uint8Array(8);
  const dv = new DataView(footer.buffer);
  dv.setUint32(0, WCRC_MAGIC, true);
  dv.setUint32(4, crc32(u8), true);
  const out = new Uint8Array(u8.length + footer.length);
  out.set(u8, 0);
  out.set(footer, u8.length);
  return out;
}

/**
 * Read footer checksum if present.
 */
export function readWalChecksum(u8: Uint8Array): { has: boolean; value?: number } {
  if (u8.length < 8) {
    return { has: false };
  }
  const dv = new DataView(u8.buffer, u8.byteOffset + u8.length - 8, 8);
  const magic = dv.getUint32(0, true);
  if (magic !== WCRC_MAGIC) {
    return { has: false };
  }
  const value = dv.getUint32(4, true);
  return { has: true, value };
}
