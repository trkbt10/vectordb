/**
 * @file Minimal happy-path spec for App component
 */
import { App } from "./App";

describe("App", () => {
  test("exports a function component", () => {
    expect(typeof App).toBe("function");
  });
});
