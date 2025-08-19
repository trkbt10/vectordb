/**
 * @file Tests for index file format (encode/decode)
 */
import { describe, it, expect } from "bun:test";
import { encodeIndexFile, decodeIndexFile } from "./index_file";

describe("indexing/formats/index_file", () => {
  it("encodes and decodes header and entries", () => {
    const header = { metricCode: 0, dim: 3, count: 2, strategyCode: 1, hasAnn: false };
    const entries = [
      { id: 1, ptr: { segment: "base.pg0.part0", offset: 8, length: 20 } },
      { id: 2, ptr: { segment: "base.pg1.part0", offset: 28, length: 20 } },
    ];
    const u8 = encodeIndexFile(header, entries);
    const dec = decodeIndexFile(u8);
    expect(dec.header).toEqual(header);
    expect(dec.entries.length).toBe(2);
    expect(dec.entries[0].id).toBe(1);
    expect(dec.entries[1].ptr.segment).toBe("base.pg1.part0");
  });
});
