/**
 * @file Minimal happy-path spec for DatabaseView
 */
import { DatabaseView } from "./DatabaseView";

describe("DatabaseView", () => {
  test("exports a function component", () => {
    expect(typeof DatabaseView).toBe("function");
  });
});
