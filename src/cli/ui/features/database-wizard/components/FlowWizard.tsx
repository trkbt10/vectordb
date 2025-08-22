/**
 * @file FlowWizard: Orchestrates multi-phase flows (QA sub-schema, review, compute, save) via a schema.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
// import TextInput from "ink-text-input"; // not used directly after commonization
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { SchemaWizard, type Field, type FieldOption, type WizardSchema } from "./SchemaWizard";
import { WizardShell, QuestionForm, ActionBar } from "../../../components/ui";
import TextInput from "ink-text-input";
import { type FlowAnswers, type FlowCondition, type FlowTransition, nextForUi } from "./flowLogic";

export type { FlowAnswers, FlowCondition, FlowTransition };

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

export type FormStep = {
  type: "form";
  id: string;
  title: string;
  description?: string | string[];
  fields: (Field | { type: "group"; label: string })[];
  allowBack?: boolean;
  defaultNext?: string;
};

export type MenuItem = { label: string; next: string; value?: string; tooltip?: string };
export type MenuStep = {
  type: "menu";
  id: string;
  title: string;
  description?: string | string[];
  items: MenuItem[];
  allowBack?: boolean;
  storeTo?: string; // if provided, store selected value
};

export type FlowStep = QaStep | UiStep | ComputeStep | WriteStep | MenuStep | FormStep;

export type FlowSchema = {
  start: string;
  steps: Record<string, FlowStep>;
  title?: string;
  display?: { id: string; label: string }[];
};

// logic moved to flowLogic.ts for unit testing

/**
 * FlowWizard: runs a FlowSchema and calls onSaved when the flow writes a file or completes.
 */
export function FlowWizard({
  schema,
  onCancel,
  onSaved,
}: {
  schema: FlowSchema;
  onCancel: () => void;
  onSaved: (path: string) => void;
}) {
  const [answers, setAnswers] = useState<FlowAnswers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [stepId, setStepId] = useState(schema.start);
  const [menuTip, setMenuTip] = useState<string | undefined>(undefined);
  const step = schema.steps[stepId];
  // Focus state must be declared before any conditional returns to keep hook order stable
  // Focus is handled inside QuestionForm; keep a no-op to maintain previous behavior if needed later
  useEffect(() => {
    if (step?.type !== "menu") {
      setMenuTip(undefined);
      return;
    }
    setMenuTip(step.items[0]?.tooltip);
  }, [stepId]);

  const descriptionLines = useMemo(() => {
    if (step?.type !== "ui") return [] as string[];
    if (!step.description) return [] as string[];
    return Array.isArray(step.description) ? step.description : [step.description];
  }, [step]);

  const stepItems: { id: string; label: string }[] = []; // hide steps sidebar per UX request

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
        <Box marginTop={1}>
          <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={back} />
        </Box>
      </Box>
    );
  }

  if (step.type === "qa") {
    return (
      <WizardShell
        title={schema.title || "Wizard"}
        steps={stepItems}
        currentId={stepId}
        footer="Enter to proceed, Ctrl+C to cancel"
      >
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

  if (step.type === "form") {
    const desc = Array.isArray(step.description) ? step.description : step.description ? [step.description] : [];
    return (
      <WizardShell
        title={schema.title || "Wizard"}
        steps={stepItems}
        currentId={stepId}
        footer="Up/Down: select field · Enter: edit · Esc: back to list · Ctrl+C: cancel"
      >
        <Text color="cyan">{step.title}</Text>
        {desc.map((line, idx) => (
          <Text key={idx} color="gray">
            {line}
          </Text>
        ))}
        <MultiFieldForm
          fields={step.fields}
          answers={answers}
          onChange={(name, v) => setAnswers((a) => ({ ...a, [name]: v }))}
          onNext={() => go(step.defaultNext)}
          onBack={step.allowBack ? () => back() : undefined}
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
    const items = [...step.items, { label: step.allowBack ? "Back" : "Cancel", next: "__back_or_cancel__" }];
    return (
      <WizardShell
        title={schema.title || "Wizard"}
        steps={stepItems}
        currentId={stepId}
        footer="Use arrows to move, Enter to select"
      >
        <Text color="cyan">{step.title}</Text>
        {desc.map((line, idx) => (
          <Text key={idx} color="gray">
            {line}
          </Text>
        ))}
        <SelectInput
          items={items.map((m, idx) => ({
            key: `${m.next}:${idx}`,
            label: m.label,
            value: m.next,
            tooltip: m.tooltip,
          }))}
          isFocused={true}
          onHighlight={(i: { label: string; value: string; tooltip?: string }) => setMenuTip(i.tooltip)}
          onSelect={(i: { label: string; value: string }) => {
            if (i.value === "__back_or_cancel__") return step.allowBack ? back() : onCancel();
            const chosen = step.items.find((m) => m.next === i.value || m.label === i.label);
            const key = step.storeTo;
            if (chosen && typeof key === "string" && typeof chosen.value === "string") {
              setAnswers((a) => ({ ...a, [key]: chosen.value }));
            }
            go(i.value);
          }}
        />
        {menuTip && (
          <Box marginTop={1}>
            <Text color="gray">{menuTip}</Text>
          </Box>
        )}
      </WizardShell>
    );
  }

  // UI step
  const preview = step.preview?.(answers);
  function renderPreview(): React.ReactNode | undefined {
    if (preview === undefined) return undefined;
    return <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text>;
  }
  // description renderer uses field.type when needed
  function renderDescription(): React.ReactNode | null {
    if (step.field.type !== "select") return null;
    if (descriptionLines.length <= 0) return null;
    return (
      <Box paddingTop={1}>
        <Text color="gray">{descriptionLines.join("\n")}</Text>
      </Box>
    );
  }
  if (step.field.type === "boolean") {
    const boolVal = Boolean((answers[step.field.name] as boolean | undefined) ?? step.field.defaultValue ?? false);
    const backHandler = step.allowBack ? () => back() : undefined;
    return (
      <WizardShell
        title={schema.title || "Wizard"}
        steps={stepItems}
        currentId={stepId}
        footer="Use arrows to choose, Enter to confirm"
      >
        <QuestionForm
          field={{ type: "boolean", name: step.field.name, label: step.field.label }}
          value={boolVal}
          onChange={(v) => setAnswers((a) => ({ ...a, [step.field.name]: v }))}
          onNext={() => go(nextForUi(step, answers) ?? stepId)}
          onBack={backHandler}
          preview={renderPreview()}
        />
      </WizardShell>
    );
  }
  function valueForField(): string {
    if (step.field.type !== "text" && step.field.type !== "number") return "";
    return String((answers[step.field.name] as string | undefined) ?? step.field.defaultValue ?? "");
  }
  const v = valueForField();
  return (
    <WizardShell
      title={schema.title || "Wizard"}
      steps={stepItems}
      currentId={stepId}
      footer="Use arrows to move, Enter to confirm"
    >
      <QuestionForm
        field={
          step.field as {
            type: "text" | "number" | "select" | "boolean";
            name: string;
            label: string;
            options?: { label: string; value: string }[];
          }
        }
        value={v}
        onChange={(nv) => setAnswers((a) => ({ ...a, [step.field.name]: nv }))}
        onNext={() => go(nextForUi(step, answers) ?? stepId)}
        onBack={step.allowBack ? (() => back()) : undefined}
        preview={renderPreview()}
      />
      {renderDescription()}
    </WizardShell>
  );
}

type GroupField = { type: "group"; label: string };

function isGroupField(it: Field | GroupField): it is GroupField {
  return it.type === "group";
}

function MultiFieldForm({
  fields,
  answers,
  onChange,
  onNext,
  onBack,
}: {
  fields: (Field | GroupField)[];
  answers: FlowAnswers;
  onChange: (name: string, value: string | number | boolean) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const [selected, setSelected] = React.useState<number>(0); // which dt is highlighted
  const [mode, setMode] = React.useState<"list" | "edit">("list"); // two-stage: list -> edit
  const [actionsFocus, setActionsFocus] = React.useState<boolean>(false);

  useInput((input, key) => {
    if (mode === "edit") return; // inputs manage keys; Esc handled by editor
    if (actionsFocus) {
      if (key.upArrow) return setActionsFocus(false);
      return; // ActionBar captures left/right/enter
    }
    const prevIdx = (() => {
      const idx = fields
        .slice(0, selected)
        .reduceRight<number>((acc, f, i) => (acc >= 0 ? acc : isGroupField(f) ? -1 : i), -1);
      return idx < 0 ? selected : idx;
    })();
    const nextIdx = (() => {
      const rel = fields.slice(selected + 1).findIndex((f) => !isGroupField(f));
      return rel < 0 ? selected : selected + 1 + rel;
    })();
    if (key.upArrow) setSelected(prevIdx);
    if (key.downArrow) setSelected(nextIdx);
    const lastIdx = (() => {
      const idx = fields
        .map((f, i) => (!isGroupField(f) ? i : -1))
        .reduce((a, b) => (b > a ? b : a), -1);
      return idx < 0 ? 0 : idx;
    })();
    if (key.downArrow && selected === lastIdx) setActionsFocus(true);
    if (key.return && !isGroupField(fields[selected])) setMode("edit");
  });

  // const f = fields[selected]; // unused
  const leftWidth = 28;

  const exitEdit = () => setMode("list");

  return (
    <Box flexDirection="column">
      {fields.map((it, i) => {
        const isSelected = i === selected;
        const isEditing = isSelected ? mode === "edit" : false;
        const highlight = !actionsFocus ? isSelected : false; // clear highlight when action bar has focus
        const lineColor: "white" | "gray" = actionsFocus ? "gray" : "white";
        if (isGroupField(it)) {
          return (
            <Box key={`group:${it.label}`} flexDirection="row" marginTop={1} marginBottom={0}>
              <Text color="cyan">{it.label}</Text>
            </Box>
          );
        }
        const rawVal = (answers[it.name] as string | number | boolean | undefined) ?? it.defaultValue;
        function displayFor(field: Field, value: unknown): string {
          if (field.type === "select") {
            const opts: FieldOption[] = field.options ?? [];
            const found = opts.find((o) => o.value === value);
            return found ? found.label : String(value ?? "");
          }
          if (field.type === "boolean") return String(Boolean(value));
          return String(value ?? "");
        }
        const display = displayFor(it, rawVal);
        const renderCell = (field: Field, editing: boolean, disp: string, value: unknown): React.ReactNode => {
          if (!editing) return <Text inverse={highlight}>{disp}</Text>;
          if (field.type === "select") {
            return (
              <SelectInput
                items={(field.options ?? []).map((o, idx) => ({ ...o, key: `${o.value}:${idx}` }))}
                isFocused={true}
                onSelect={(sel: { label: string; value: string }) => {
                  onChange(field.name, sel.value);
                  exitEdit();
                }}
              />
            );
          }
          if (field.type === "boolean") {
            return (
              <SelectInput
                items={[{ label: "No", value: "false" }, { label: "Yes", value: "true" }]}
                isFocused={true}
                onSelect={(sel) => {
                  onChange(field.name, sel.value === "true");
                  exitEdit();
                }}
              />
            );
          }
          return (
            <TextInput
              value={String(value ?? "")}
              focus={true}
              onChange={(v) => onChange(field.name, field.type === "number" ? Number(v) : v)}
              onSubmit={exitEdit}
            />
          );
        };
        return (
          <Box key={it.name} flexDirection="row" marginBottom={0}>
            <Box width={leftWidth} marginRight={1}>
              <Text inverse={highlight}>{it.label}</Text>
            </Box>
            <Box width={1}>
              <Text color={lineColor}>│</Text>
            </Box>
            <Box flexGrow={1}>
              {renderCell(it, isEditing, display, rawVal)}
              {isEditing ? <EscCatcher onEsc={exitEdit} /> : null}
            </Box>
          </Box>
          
        );
      })}
      <Box marginTop={1}>
        <ActionBar
          items={[{ label: "Next", value: "__next" }, ...(onBack ? [{ label: "Back", value: "__back" }] : [])]}
          focus={actionsFocus}
          onSelect={(val) => (val === "__back" ? onBack?.() : onNext())}
        />
      </Box>
    </Box>
  );
}

function EscCatcher({ onEsc }: { onEsc: () => void }) {
  useInput((input, key) => {
    if (key.escape) onEsc();
  });
  return <></>;
}
