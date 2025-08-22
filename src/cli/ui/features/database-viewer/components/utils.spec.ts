/**
 * @file Unit tests for DatabaseExplorer presentation helpers
 */
import { truncate, vectorPreview } from "./utils";

describe("utils", () => {
  test("truncate short and long strings", () => {
    expect(truncate("abc", 5)).toBe("abc");
    expect(truncate("abcdef", 5)).toBe("abcd…");
  });

  test("vectorPreview shows first elements and ellipsis", () => {
    expect(vectorPreview(new Float32Array([]))).toBe("[]");
    expect(vectorPreview(new Float32Array([1, 2, 3]))).toBe("[1.000, 2.000, 3.000]");
    expect(vectorPreview(new Float32Array([1, 2, 3, 4]), 2)).toBe("[1.000, 2.000, …]");
  });
});
