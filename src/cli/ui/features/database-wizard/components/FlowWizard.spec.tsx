/**
 * @file Minimal happy-path spec for FlowWizard
 */
import { FlowWizard } from "./FlowWizard";

describe("FlowWizard", () => {
  test("exports a function component", () => {
    expect(typeof FlowWizard).toBe("function");
  });
});

