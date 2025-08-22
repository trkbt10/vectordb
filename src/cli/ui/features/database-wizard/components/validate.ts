/**
 * @file Schema validators for WizardSchema and FlowSchema
 */
import type { Step, Field } from "./SchemaWizard";
import type { FlowStep } from "./FlowWizard";

export type Validation = { ok: true } | { ok: false; errors: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object") return false;
  return v !== null;
}

function validateField(field: Field, ctx: string, errors: string[]) {
  if (!field || !("type" in field)) {
    errors.push(`${ctx}: missing field`);
    return;
  }
  if (field.type === "select") {
    if (!Array.isArray(field.options) || field.options.length === 0)
      errors.push(`${ctx}: select requires non-empty options`);
    if (!field.name) errors.push(`${ctx}: field.name required`);
    if (!field.label) errors.push(`${ctx}: field.label required`);
    return;
  }
  if (field.type === "text" || field.type === "number") {
    if (!field.name) errors.push(`${ctx}: field.name required`);
    if (!field.label) errors.push(`${ctx}: field.label required`);
    return;
  }
  if (field.type === "boolean") {
    if (!field.name) errors.push(`${ctx}: field.name required`);
    if (!field.label) errors.push(`${ctx}: field.label required`);
    return;
  }
  errors.push(`${ctx}: unknown field.type`);
}

/**
 * Validate a WizardSchema shape.
 * Ensures non-empty start/steps and basic field requirements per step.
 */
export function validateWizardSchema(schema: unknown): Validation {
  const errors: string[] = [];
  if (!isRecord(schema)) return { ok: false, errors: ["schema must be an object"] };
  const start = schema.start as unknown;
  const steps = schema.steps as unknown;
  if (typeof start !== "string" || !start) errors.push("start must be a non-empty string");
  if (!isRecord(steps) || Object.keys(steps).length === 0) errors.push("steps must be a non-empty object");
  if (!errors.length && isRecord(steps)) {
    const step = (steps as Record<string, unknown>)[start as string] as Step | undefined;
    if (!step) errors.push(`steps must include start step: ${String(start)}`);
  }
  if (isRecord(steps)) {
    for (const [id, s] of Object.entries(steps)) {
      const ctx = `wizard.step[${id}]`;
      const step = s as Step;
      if (!isRecord(step)) {
        errors.push(`${ctx}: must be an object`);
        continue;
      }
      if (!("id" in step) || (step as { id?: unknown }).id !== id) errors.push(`${ctx}: id must equal key`);
      validateField(step.field as Field, `${ctx}.field`, errors);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Validate a FlowSchema shape.
 * Verifies start/steps and per-step invariants (qa/ui/compute/write).
 */
export function validateFlowSchema(flow: unknown): Validation {
  const errors: string[] = [];
  if (!isRecord(flow)) return { ok: false, errors: ["flow must be an object"] };
  const start = flow.start as unknown;
  const steps = flow.steps as unknown;
  if (typeof start !== "string" || !start) errors.push("start must be a non-empty string");
  if (!isRecord(steps) || Object.keys(steps).length === 0) errors.push("steps must be a non-empty object");
  if (!errors.length && isRecord(steps)) {
    const step = (steps as Record<string, unknown>)[start as string] as FlowStep | undefined;
    if (!step) errors.push(`steps must include start step: ${String(start)}`);
  }
  if (isRecord(steps)) {
    for (const [id, raw] of Object.entries(steps)) {
      const s = raw as FlowStep;
      const ctx = `flow.step[${id}]`;
      if (!isRecord(s) || !("type" in s)) {
        errors.push(`${ctx}: missing type`);
        continue;
      }
      if (s.type === "qa") {
        const schemaVal = (s as Record<string, unknown>)["schema"];
        if (!isRecord(schemaVal)) errors.push(`${ctx}: qa requires schema`);
        const res = validateWizardSchema(schemaVal);
        if (!res.ok) errors.push(...res.errors.map((e) => `${ctx}: ${e}`));
        if (!("next" in (s as Record<string, unknown>))) errors.push(`${ctx}: qa requires next`);
        continue;
      }
      if (s.type === "ui") {
        validateField((s as Record<string, unknown>)["field"] as Field, `${ctx}.field`, errors);
        continue;
      }
      if (s.type === "compute") {
        const run = (s as Record<string, unknown>)["run"];
        if (typeof run !== "function") errors.push(`${ctx}: compute requires run()`);
        if (!("next" in (s as Record<string, unknown>))) errors.push(`${ctx}: compute requires next`);
        continue;
      }
      if (s.type === "write") {
        const pathFrom = (s as Record<string, unknown>)["pathFrom"];
        const dataFrom = (s as Record<string, unknown>)["dataFrom"];
        if (typeof pathFrom !== "function") errors.push(`${ctx}: write requires pathFrom()`);
        if (typeof dataFrom !== "function") errors.push(`${ctx}: write requires dataFrom()`);
        continue;
      }
      errors.push(`${ctx}: unknown step type ${(s as Record<string, unknown>)["type"]}`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
