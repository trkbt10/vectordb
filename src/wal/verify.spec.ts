/**
 * @file WAL checksum + verify tests
 */
import { addWalChecksum, verifyWal, encodeWal } from "./index";

describe("wal/verify + checksum", () => {
  it("reports present:true and ok:true when checksum matches", () => {
    const wal = encodeWal([{ type: "remove", id: 1 }]);
    const withCk = addWalChecksum(wal);
    const res = verifyWal(withCk);
    expect(res.ok).toBe(true);
    expect(res.checksum?.present).toBe(true);
    expect(res.checksum?.ok).toBe(true);
  });

  it("reports present:false when checksum footer is missing", () => {
    const wal = encodeWal([{ type: "remove", id: 2 }]);
    const res = verifyWal(wal);
    expect(res.ok).toBe(true);
    expect(res.checksum?.present).toBe(false);
  });

  it("detects checksum mismatch and sets ok=false", () => {
    const wal = encodeWal([{ type: "remove", id: 3 }]);
    const withCk = addWalChecksum(wal);
    const tampered = new Uint8Array(withCk);
    tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0xff;
    const res = verifyWal(tampered);
    expect(res.ok).toBe(false);
    expect(res.checksum?.present).toBe(true);
    expect(res.checksum?.ok).toBe(false);
  });

  it("sets ok=false with error when body is malformed", () => {
    const bad = new Uint8Array([1, 2, 3]);
    const res = verifyWal(bad);
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
