/**
 * @file Minimal happy-path spec for DatabaseExplorer
 */
import { DatabaseExplorer } from "./DatabaseExplorer";

describe("DatabaseExplorer", () => {
  test("exports a function component", () => {
    expect(typeof DatabaseExplorer).toBe("function");
  });
});
