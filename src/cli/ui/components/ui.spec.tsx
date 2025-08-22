/**
 * @file Minimal happy-path specs for UI primitives
 */
import { Title, HLine, Breadcrumbs, Hint, WizardShell, QuestionForm, ActionBar } from "./ui";

describe("ui primitives", () => {
  test("exports are functions", () => {
    expect(typeof Title).toBe("function");
    expect(typeof HLine).toBe("function");
    expect(typeof Breadcrumbs).toBe("function");
    expect(typeof Hint).toBe("function");
    expect(typeof WizardShell).toBe("function");
    expect(typeof QuestionForm).toBe("function");
    expect(typeof ActionBar).toBe("function");
  });
});
