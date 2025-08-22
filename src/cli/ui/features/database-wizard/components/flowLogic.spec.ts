/**
 * @file Unit tests for FlowWizard logic helpers
 */
import { evalCond, nextForUi, type FlowAnswers, type FlowCondition } from "./flowLogic";

describe("flowLogic", () => {
  test("evalCond equals/in/not", () => {
    const a: FlowAnswers = { x: 1, y: "a" };
    const c1: FlowCondition = { op: "equals", field: "x", value: 1 };
    const c2: FlowCondition = { op: "in", field: "y", values: ["a", "b"] };
    const c3: FlowCondition = { op: "not", cond: { op: "equals", field: "x", value: 2 } };
    expect(evalCond(c1, a)).toBe(true);
    expect(evalCond(c2, a)).toBe(true);
    expect(evalCond(c3, a)).toBe(true);
  });

  test("nextForUi picks matching transition or default", () => {
    const step = {
      transitions: [
        { when: { op: "equals" as const, field: "k", value: "a" }, next: "A" },
        { when: { op: "equals" as const, field: "k", value: "b" }, next: "B" },
      ],
      defaultNext: "Z",
    };
    expect(nextForUi(step, { k: "a" })).toBe("A");
    expect(nextForUi(step, { k: "c" })).toBe("Z");
  });
});
