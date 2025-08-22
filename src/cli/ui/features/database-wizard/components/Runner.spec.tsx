/**
 * @file Minimal happy-path spec for Runner
 */
import { Runner } from "./Runner";

describe("Runner", () => {
  test("exports a function component", () => {
    expect(typeof Runner).toBe("function");
  });
});
