/**
 * @file Minimal happy-path spec for Home screen
 */
import { Home } from "./Home";

describe("Home", () => {
  test("exports a function component", () => {
    expect(typeof Home).toBe("function");
  });
});

