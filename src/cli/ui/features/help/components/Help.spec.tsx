/**
 * @file Minimal happy-path spec for Help screen
 */
import { Help } from "./Help";

describe("Help", () => {
  test("exports a function component", () => {
    expect(typeof Help).toBe("function");
  });
});
