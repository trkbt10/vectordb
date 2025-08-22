/**
 * @file WAL decode error-path tests
 */
import { decodeWal } from "./index";

test("decodeWal throws on short buffer (< header)", () => {
  const tooShort = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
  expect(() => decodeWal(tooShort)).toThrow(/wal too short/);
});

test("decodeWal throws on bad magic", () => {
  // valid length header, wrong magic, version=1
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x41414141, true); // 'AAAA'
  dv.setUint32(4, 1, true);
  expect(() => decodeWal(buf)).toThrow(/bad wal magic/);
});

test("decodeWal throws on unsupported version", () => {
  // correct magic, wrong version
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x564c5741, true); // 'VLWA'
  dv.setUint32(4, 99, true);
  expect(() => decodeWal(buf)).toThrow(/unsupported wal version/);
});

test("decodeWal throws on truncated header in concatenated stream", () => {
  // First valid header, then truncated 2nd header (only 4 bytes)
  const first = new Uint8Array(8);
  const dv1 = new DataView(first.buffer);
  dv1.setUint32(0, 0x564c5741, true);
  dv1.setUint32(4, 1, true);
  const secondPartial = new Uint8Array([0x41, 0x57, 0x4c, 0x56]); // reversed order doesn't matter here
  const merged = new Uint8Array(first.length + secondPartial.length);
  merged.set(first, 0);
  merged.set(secondPartial, first.length);
  expect(() => decodeWal(merged)).toThrow();
});

test("decodeWal throws on truncated record body (metaLen too large)", () => {
  // Header
  const header = new Uint8Array(8);
  const dvh = new DataView(header.buffer);
  dvh.setUint32(0, 0x564c5741, true);
  dvh.setUint32(4, 1, true);
  // Record: type=3 (setMeta), id=1, metaLen=100 but provide none
  const rec = new Uint8Array(1 + 1 + 4 + 4 + 4);
  const dvr = new DataView(rec.buffer);
  dvr.setUint8(0, 3);
  dvr.setUint8(1, 0);
  dvr.setUint32(2, 1, true);
  dvr.setUint32(6, 100, true); // metaLen too big
  dvr.setUint32(10, 0, true);
  const merged = new Uint8Array(header.length + rec.length);
  merged.set(header, 0);
  merged.set(rec, header.length);
  expect(() => decodeWal(merged)).toThrow();
});
