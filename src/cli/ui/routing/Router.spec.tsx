/**
 * @file Tests for Router component
 */
import { Router } from "./Router";

describe("Router", () => {
  test("module exports Router", () => {
    expect(typeof Router).toBe("function");
  });

  test("Router is a function component", () => {
    expect(Router.name).toBe("Router");
    expect(Router.length).toBe(1); // Takes props argument
  });
});