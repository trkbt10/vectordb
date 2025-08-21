/**
 * @file FlowWizard: Orchestrates multi-phase flows (QA sub-schema, review, compute, save) via a schema.
 */
import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
// import TextInput from "ink-text-input"; // not used directly after commonization
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { SchemaWizard, type Field, type WizardSchema } from "./SchemaWizard";
import { WizardShell, QuestionForm } from "../../../components/ui";

export type FlowAnswers = Record<string, unknown>;

export type FlowCondition =
  | { op: "equals"; field: string; value: string | number | boolean }
  | { op: "in"; field: string; values: (string | number | boolean)[] }
  | { op: "not"; cond: FlowCondition };

export type FlowTransition = { when: FlowCondition; next: string };

export type QaStep = {
  type: "qa";
  id: string;
  title?: string;
  schema: WizardSchema;
  namespace?: string; // store answers under this key; if omitted, merge
  next: string;
};

export type UiStep = {
  type: "ui";
  id: string;
  title: string;
  description?: string | string[];
  field: Field;
  allowBack?: boolean;
  transitions?: FlowTransition[];
  defaultNext?: string;
  preview?: (answers: FlowAnswers) => unknown; // show JSON or lines before field
};

export type ComputeStep = {
  type: "compute";
  id: string;
  title?: string;
  run: (answers: FlowAnswers) => Promise<Partial<FlowAnswers>> | Partial<FlowAnswers>;
  next: string;
};

export type WriteStep = {
  type: "write";
  id: string;
  title?: string;
  pathFrom: (answers: FlowAnswers) => string;
  dataFrom: (answers: FlowAnswers) => unknown;
  next?: string; // if omitted, completes the flow
};

export type MenuItem = { label: string; next: string; value?: string };
export type MenuStep = {
  type: "menu";
  id: string;
  title: string;
  description?: string | string[];
  items: MenuItem[];
  allowBack?: boolean;
  storeTo?: string; // if provided, store selected value
};

export type FlowStep = QaStep | UiStep | ComputeStep | WriteStep | MenuStep;

export type FlowSchema = {
  start: string;
  steps: Record<string, FlowStep>;
  title?: string;
  display?: { id: string; label: string }[];
};

function evalCond(cond: FlowCondition, answers: FlowAnswers): boolean {
  if (cond.op === "equals") return answers[cond.field] === cond.value;
  if (cond.op === "in") return cond.values.includes(answers[cond.field] as never);
  if (cond.op === "not") return !evalCond(cond.cond, answers);
  return false;
}

function nextForUi(step: UiStep, answers: FlowAnswers): string | undefined {
  for (const t of step.transitions ?? []) {
    if (evalCond(t.when, answers)) return t.next;
  }
  return step.defaultNext;
}

/**
 * FlowWizard: runs a FlowSchema and calls onSaved when the flow writes a file or completes.
 */
export function FlowWizard({ schema, onCancel, onSaved }: { schema: FlowSchema; onCancel: () => void; onSaved: (path: string) => void }) {
  const [answers, setAnswers] = useState<FlowAnswers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [stepId, setStepId] = useState(schema.start);
  const step = schema.steps[stepId];
  // Focus state must be declared before any conditional returns to keep hook order stable
  // Focus is handled inside QuestionForm; keep a no-op to maintain previous behavior if needed later

  const descriptionLines = useMemo(() => {
    if (step?.type !== "ui") return [] as string[];
    if (!step.description) return [] as string[];
    return Array.isArray(step.description) ? step.description : [step.description];
  }, [step]);

  const stepItems = useMemo<{ id: string; label: string }[]>(() => {
    if (schema.display && schema.display.length > 0) return schema.display;
    return Object.entries(schema.steps).map(([id, s]) => ({ id, label: ("title" in s ? (s as { title?: string }).title ?? id : id) }));
  }, [schema]);

  function go(next: string | undefined) {
    if (!next) return onCancel();
    setHistory((h) => [...h, stepId]);
    setStepId(next);
  }

  function back() {
    const prev = history[history.length - 1];
    if (!prev) return onCancel();
    setHistory((h) => h.slice(0, h.length - 1));
    setStepId(prev);
  }

  if (!step) {
    return (
      <Box flexDirection="column">
        <Text color="red">Invalid flow: unknown step {stepId}</Text>
        <Box marginTop={1}><SelectInput items={[{ label: "Back", value: "back" }]} onSelect={back} /></Box>
      </Box>
    );
  }

  if (step.type === "qa") {
    return (
      <WizardShell title={schema.title || "Wizard"} steps={stepItems} currentId={stepId} footer="Enter to proceed, Ctrl+C to cancel">
        <SchemaWizard
          schema={step.schema}
          onCancel={onCancel}
          onComplete={(ans) => {
            setAnswers((a) => (step.namespace ? { ...a, [step.namespace]: ans } : { ...a, ...ans }));
            go(step.next);
          }}
        />
      </WizardShell>
    );
  }

  if (step.type === "compute") {
    (async () => {
      const partial = await step.run(answers);
      setAnswers((a) => ({ ...a, ...partial }));
      go(step.next);
    })();
    return (
      <WizardShell title={schema.title || "Wizard"} steps={stepItems} currentId={stepId} footer="Working...">
        <Text color="gray">Computing...</Text>
      </WizardShell>
    );
  }

  if (step.type === "write") {
    (async () => {
      try {
        const p = path.resolve(step.pathFrom(answers));
        const data = step.dataFrom(answers);
        await mkdir(path.dirname(p), { recursive: true });
        await writeFile(p, JSON.stringify(data, null, 2), "utf8");
        onSaved(p);
      } catch (e) {
        // surface error as a UI step
        const msg = String((e as { message?: unknown })?.message ?? e);
        setAnswers((a) => ({ ...a, __error: msg }));
        if (step.next) go(step.next);
      }
    })();
    return (
      <WizardShell title={schema.title || "Wizard"} steps={stepItems} currentId={stepId} footer="Writing...">
        <Text color="gray">Writing configuration...</Text>
      </WizardShell>
    );
  }

  if (step.type === "menu") {
    const desc = Array.isArray(step.description) ? step.description : step.description ? [step.description] : [];
    const items = [
      ...step.items,
      { label: step.allowBack ? "Back" : "Cancel", next: "__back_or_cancel__" },
    ];
    return (
      <WizardShell title={schema.title || "Wizard"} steps={stepItems} currentId={stepId} footer="Use arrows to move, Enter to select">
        <Text color="cyan">{step.title}</Text>
        {desc.map((line, idx) => (
          <Text key={idx} color="gray">{line}</Text>
        ))}
        <SelectInput
          items={items.map((m) => ({ label: m.label, value: m.next }))}
          isFocused={true}
          onSelect={(i: { label: string; value: string }) => {
            if (i.value === "__back_or_cancel__") return step.allowBack ? back() : onCancel();
            const chosen = step.items.find((m) => m.next === i.value || m.label === i.label);
            if (chosen && step.storeTo && chosen.value !== undefined) {
              setAnswers((a) => ({ ...a, [step.storeTo as string]: chosen.value as string }));
            }
            go(i.value);
          }}
        />
      </WizardShell>
    );
  }

  // UI step
  const preview = step.preview?.(answers);
  const isSelect = step.field.type === "select";
  if (step.field.type === "boolean") {
    const boolVal = Boolean((answers[step.field.name] as boolean | undefined) ?? (step.field.defaultValue ?? false));
    return (
      <WizardShell title={schema.title || "Wizard"} steps={stepItems} currentId={stepId} footer="Use arrows to choose, Enter to confirm">
        <QuestionForm
          field={{ type: "boolean", name: step.field.name, label: step.field.label }}
          value={boolVal}
          onChange={(v) => setAnswers((a) => ({ ...a, [step.field.name]: v }))}
          onNext={() => go(nextForUi(step, answers) ?? stepId)}
          onBack={step.allowBack ? () => back() : undefined}
          preview={preview !== undefined ? <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text> : undefined}
        />
      </WizardShell>
    );
  }
  const v =
    step.field.type === "text" || step.field.type === "number"
      ? String((answers[step.field.name] as string | undefined) ?? (step.field.defaultValue ?? ""))
      : "";
  return (
    <WizardShell title={schema.title || "Wizard"} steps={stepItems} currentId={stepId} footer="Use arrows to move, Enter to confirm">
      <QuestionForm
        field={step.field as { type: "text" | "number" | "select" | "boolean"; name: string; label: string; options?: { label: string; value: string }[] }}
        value={v}
        onChange={(nv) => setAnswers((a) => ({ ...a, [step.field.name]: nv }))}
        onNext={() => go(nextForUi(step, answers) ?? stepId)}
        onBack={step.allowBack ? () => back() : undefined}
        preview={preview !== undefined ? <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text> : undefined}
      />
      {isSelect && descriptionLines.length > 0 && (
        <Box paddingTop={1}>
          <Text color="gray">{descriptionLines.join("\n")}</Text>
        </Box>
      )}
    </WizardShell>
  );
}

