/**
 * @file FlowWizard: Orchestrates multi-phase flows (QA sub-schema, review, compute, save) via a schema.
 */
import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { SchemaWizard, type Field, type WizardSchema } from "./SchemaWizard";

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

export type FlowStep = QaStep | UiStep | ComputeStep | WriteStep;

export type FlowSchema = {
  start: string;
  steps: Record<string, FlowStep>;
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

  const descriptionLines = useMemo(() => {
    if (step?.type !== "ui") return [] as string[];
    if (!step.description) return [] as string[];
    return Array.isArray(step.description) ? step.description : [step.description];
  }, [step]);

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
      <SchemaWizard
        schema={step.schema}
        onCancel={onCancel}
        onComplete={(ans) => {
          setAnswers((a) => (step.namespace ? { ...a, [step.namespace]: ans } : { ...a, ...ans }));
          go(step.next);
        }}
      />
    );
  }

  if (step.type === "compute") {
    (async () => {
      const partial = await step.run(answers);
      setAnswers((a) => ({ ...a, ...partial }));
      go(step.next);
    })();
    return (
      <Box><Text color="gray">Computing...</Text></Box>
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
      <Box><Text color="gray">Writing configuration...</Text></Box>
    );
  }

  // UI step
  const preview = step.preview?.(answers);
  const isSelect = step.field.type === "select";
  if (step.field.type === "boolean") {
    const boolVal = Boolean((answers[step.field.name] as boolean | undefined) ?? (step.field.defaultValue ?? false));
    return (
      <Box flexDirection="column">
        <Text color="cyan">{step.title}</Text>
        {preview !== undefined && (
          <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text>
        )}
        <Text>{step.field.label}</Text>
        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: boolVal ? "Yes (toggle)" : "No (toggle)", value: "__toggle" },
              { label: "Next", value: "__next" },
              { label: step.allowBack ? "Back" : "Cancel", value: "__back_or_cancel" },
            ]}
            onSelect={(i) => {
              if (i.value === "__back_or_cancel") return step.allowBack ? back() : onCancel();
              if (i.value === "__toggle") return setAnswers((a) => ({ ...a, [step.field.name]: !boolVal }));
              go(nextForUi(step, answers));
            }}
          />
        </Box>
      </Box>
    );
  }
  const v =
    step.field.type === "text" || step.field.type === "number"
      ? String((answers[step.field.name] as string | undefined) ?? (step.field.defaultValue ?? ""))
      : "";
  return (
    <Box flexDirection={isSelect ? "row" : "column"}>
      <Box width={isSelect ? 44 : undefined} flexDirection="column">
        <Text color="cyan">{step.title}</Text>
        {preview !== undefined && (
          <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text>
        )}
        {step.field.type === "select" ? (
          <SelectInput
            items={[...step.field.options, { label: step.allowBack ? "Back" : "Cancel", value: "__back_or_cancel" }]}
            onSelect={(i: { label: string; value: string }) => {
              if (i.value === "__back_or_cancel") return step.allowBack ? back() : onCancel();
              const updated = { ...answers, [step.field.name]: i.value };
              setAnswers(updated);
              go(nextForUi(step, updated));
            }}
          />
        ) : (
          <>
            <Box>
              <Box width={20}><Text>{step.field.label}</Text></Box>
              <TextInput value={v} onChange={(nv) => setAnswers((a) => ({ ...a, [step.field.name]: nv }))} />
            </Box>
            <Box marginTop={1}>
              <SelectInput
                items={[{ label: "Next", value: "__next" }, { label: step.allowBack ? "Back" : "Cancel", value: "__back_or_cancel" }]}
                onSelect={(i) => i.value === "__back_or_cancel" ? (step.allowBack ? back() : onCancel()) : go(nextForUi(step, answers))}
              />
            </Box>
          </>
        )}
      </Box>
      {isSelect && (
        <Box paddingLeft={2} flexGrow={1} flexDirection="column">
          {descriptionLines.length > 0 && <Text color="gray">Description</Text>}
          {descriptionLines.map((line, idx) => (
            <Text key={idx}>{line}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
