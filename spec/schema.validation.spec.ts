/**
 * @file Schema validation specs for WizardSchema and FlowSchema
 */
import { validateWizardSchema, validateFlowSchema } from "../src/cli/ui/features/database-wizard/components/validate";

// Use Vitest globals (configured in vitest.config.ts)

describe("WizardSchema validation", () => {
  it("accepts a minimal valid wizard schema", () => {
    const schema = {
      start: "s1",
      steps: {
        s1: {
          id: "s1",
          title: "Q1",
          field: { type: "text", name: "n", label: "Name" },
        },
      },
    } as const;
    const res = validateWizardSchema(schema);
    expect(res.ok).toBe(true);
  });

  it("rejects when start is missing or steps empty", () => {
    const invalid1 = {} as unknown;
    const invalid2 = { start: "s1", steps: {} } as unknown;
    expect(validateWizardSchema(invalid1).ok).toBe(false);
    expect(validateWizardSchema(invalid2).ok).toBe(false);
  });

  it("rejects when select has no options", () => {
    const schema = {
      start: "s1",
      steps: {
        s1: { id: "s1", title: "Q1", field: { type: "select", name: "x", label: "X", options: [] } },
      },
    } as const;
    const res = validateWizardSchema(schema);
    expect(res.ok).toBe(false);
  });
});

describe("FlowSchema validation", () => {
  const wizard = {
    start: "s1",
    steps: { s1: { id: "s1", title: "Q1", field: { type: "text", name: "n", label: "Name" } } },
  } as const;

  it("accepts a valid flow with qa/ui/write", () => {
    const flow = {
      start: "qa",
      steps: {
        qa: { type: "qa", id: "qa", schema: wizard, next: "review" },
        review: {
          type: "ui",
          id: "review",
          title: "Review",
          field: { type: "text", name: "p", label: "Path" },
          defaultNext: "write",
        },
        write: { type: "write", id: "write", pathFrom: () => "./tmp.json", dataFrom: () => ({}) },
      },
    } as const;
    const res = validateFlowSchema(flow);
    expect(res.ok).toBe(true);
  });

  it("rejects a compute step without run/next", () => {
    const flow = {
      start: "c",
      steps: {
        c: { type: "compute", id: "c" },
      },
    } as unknown;
    const res = validateFlowSchema(flow);
    expect(res.ok).toBe(false);
  });
});
