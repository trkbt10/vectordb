/**
 * @file Minimal happy-path spec for Settings screen
 */
import { Settings } from "./Settings";

describe("Settings", () => {
  test("exports a function component", () => {
    expect(typeof Settings).toBe("function");
  });
});
