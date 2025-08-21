/**
 * @file Tests for enum codec
 */
import { createEnumCodec } from "./enum_codec";

describe("util/enum_codec", () => {
  it("encodes and decodes valid keys; rejects duplicates/unknowns", () => {
    const codec = createEnumCodec({ A: 1, B: 2 } as const);
    expect(codec.encode("A")).toBe(1);
    expect(codec.decode(2)).toBe("B");
    expect(() => codec.decode(9)).toThrow(/unsupported code/);
    const dup = { X: 1, Y: 1 } as const;
    expect(() => createEnumCodec(dup as unknown as Record<"X" | "Y", number>)).toThrow(/duplicate code/);
  });
});
