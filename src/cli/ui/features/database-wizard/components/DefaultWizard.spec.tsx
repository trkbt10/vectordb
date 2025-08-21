/**
 * @file Minimal happy-path spec for DefaultWizard
 */
import { DefaultWizard } from "./DefaultWizard";

describe("DefaultWizard", () => {
  test("exports a function component", () => {
    expect(typeof DefaultWizard).toBe("function");
  });
});

