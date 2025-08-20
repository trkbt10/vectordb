/**
 * @file Tests for NavigationContext
 */
import { NavigationProvider, useNavigation } from "./NavigationContext";

describe("NavigationContext", () => {
  test("module exports NavigationProvider and useNavigation", () => {
    expect(typeof NavigationProvider).toBe("function");
    expect(typeof useNavigation).toBe("function");
  });

  test("NavigationProvider is a function component", () => {
    expect(NavigationProvider.name).toBe("NavigationProvider");
    expect(NavigationProvider.length).toBe(1); // Takes props argument
  });

  test("useNavigation is a hook function", () => {
    expect(useNavigation.name).toBe("useNavigation");
    expect(useNavigation.length).toBe(0); // No arguments
  });
});