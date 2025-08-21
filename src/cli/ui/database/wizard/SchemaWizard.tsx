/**
 * @file SchemaWizard: declarative, schema-driven Q&A wizard with branching
 */
import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";

// Schema types
export type FieldType = "select" | "text" | "number" | "boolean";

export type FieldOption = { label: string; value: string };

export type Field =
  | {
      type: "select";
      name: string;
      label: string;
      options: FieldOption[];
      placeholder?: string;
      defaultValue?: string;
    }
  | {
      type: "text" | "number";
      name: string;
      label: string;
      placeholder?: string;
      defaultValue?: string;
    }
  | {
      type: "boolean";
      name: string;
      label: string;
      defaultValue?: boolean;
    };

export type Condition =
  | { op: "equals"; field: string; value: string | number | boolean }
  | { op: "in"; field: string; values: (string | number | boolean)[] }
  | { op: "not"; cond: Condition };

export type Transition = { when: Condition; next: string };

export type Step = {
  id: string;
  title: string;
  description?: string | string[];
  field: Field;
  transitions?: Transition[];
  defaultNext?: string; // If omitted, reaching end completes the wizard
  allowBack?: boolean;
};

export type WizardSchema = {
  start: string;
  steps: Record<string, Step>;
};

export type Answers = Record<string, string | number | boolean | undefined>;

function evalCond(cond: Condition, answers: Answers): boolean {
  if (cond.op === "equals") return answers[cond.field] === cond.value;
  if (cond.op === "in") return cond.values.includes(answers[cond.field] as never);
  if (cond.op === "not") return !evalCond(cond.cond, answers);
  return false;
}

function nextStepFor(step: Step, answers: Answers): string | undefined {
  for (const t of step.transitions ?? []) {
    if (evalCond(t.when, answers)) return t.next;
  }
  return step.defaultNext;
}

/**
 * SchemaWizard: Render a declarative, branching Q&A flow from a WizardSchema.
 */
export function SchemaWizard({
  schema,
  initialAnswers,
  onCancel,
  onComplete,
}: {
  schema: WizardSchema;
  initialAnswers?: Answers;
  onCancel: () => void;
  onComplete: (answers: Answers) => void;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [history, setHistory] = useState<string[]>([]); // step id stack for Back
  const [stepId, setStepId] = useState<string>(schema.start);

  const step = schema.steps[stepId];
  const value = answers[step.field.name];

  const descriptionLines = useMemo(() => {
    if (!step.description) return [] as string[];
    return Array.isArray(step.description) ? step.description : [step.description];
  }, [step.description]);

  function goNext(updated: Answers) {
    const next = nextStepFor(step, updated);
    if (!next) return onComplete(updated);
    setHistory((h) => [...h, step.id]);
    setStepId(next);
  }

  function goBack() {
    const prev = history[history.length - 1];
    if (!prev) return onCancel();
    setHistory((h) => h.slice(0, h.length - 1));
    setStepId(prev);
  }

  // Render per field type
  if (step.field.type === "select") {
    const current = step.field.options.find((o) => o.value === value);
    const items = [
      ...step.field.options,
      { label: step.allowBack ? "Back" : "Cancel", value: "__back_or_cancel" },
    ];
    return (
      <Box flexDirection="row">
        <Box width={44} flexDirection="column">
          <Text color="cyan">{step.title}</Text>
          <SelectInput
            items={items}
            initialIndex={current ? step.field.options.indexOf(current) : 0}
            onSelect={(i: { label: string; value: string }) => {
              if (i.value === "__back_or_cancel") return step.allowBack ? goBack() : onCancel();
              const updated = { ...answers, [step.field.name]: i.value };
              setAnswers(updated);
              goNext(updated);
            }}
          />
        </Box>
        <Box paddingLeft={2} flexGrow={1} flexDirection="column">
          {descriptionLines.length > 0 && <Text color="gray">説明</Text>}
          {descriptionLines.map((line, idx) => (
            <Text key={idx}>{line}</Text>
          ))}
        </Box>
      </Box>
    );
  }

  if (step.field.type === "text" || step.field.type === "number") {
    const v = value === undefined ? step.field.defaultValue ?? "" : String(value);
    return (
      <Box flexDirection="column">
        <Text color="cyan">{step.title}</Text>
        <Box>
          <Box width={20}>
            <Text>{step.field.label}</Text>
          </Box>
          <TextInput
            value={v as string}
            onChange={(nv) => setAnswers((a) => ({ ...a, [step.field.name]: nv }))}
          />
        </Box>
        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: "Next", value: "__next" },
              { label: step.allowBack ? "Back" : "Cancel", value: "__back_or_cancel" },
            ]}
            onSelect={(i) =>
              i.value === "__back_or_cancel"
                ? step.allowBack
                  ? goBack()
                  : onCancel()
                : goNext(answers)
            }
          />
        </Box>
      </Box>
    );
  }

  // boolean
  const boolVal = Boolean(value ?? step.field.defaultValue ?? false);
  return (
    <Box flexDirection="column">
      <Text color="cyan">{step.title}</Text>
      <Text>{step.field.label}</Text>
      <Box marginTop={1}>
        <SelectInput
          items={[
            { label: boolVal ? "Yes (toggle)" : "No (toggle)", value: "__toggle" },
            { label: "Next", value: "__next" },
            { label: step.allowBack ? "Back" : "Cancel", value: "__back_or_cancel" },
          ]}
          onSelect={(i) => {
            if (i.value === "__back_or_cancel") return step.allowBack ? goBack() : onCancel();
            if (i.value === "__toggle") return setAnswers((a) => ({ ...a, [step.field.name]: !boolVal }));
            goNext(answers);
          }}
        />
      </Box>
    </Box>
  );
}
