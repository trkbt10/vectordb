/**
 * @file FlowWizard: Orchestrates multi-phase flows (QA sub-schema, review, compute, save) via a schema.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
// import TextInput from "ink-text-input"; // not used directly after commonization
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { SchemaWizard, type Field, type WizardSchema } from "./SchemaWizard";
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
    if (step?.type === "menu") {
      setMenuTip(step.items[0]?.tooltip);
    } else {
      setMenuTip(undefined);
    }
  }, [stepId]);

  const descriptionLines = useMemo(() => {
    if (step?.type !== "ui") return [] as string[];
    if (!step.description) return [] as string[];
    return Array.isArray(step.description) ? step.description : [step.description];
  }, [step]);

  const stepItems = [] as { id: string; label: string }[]; // hide steps sidebar per UX request

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
            if (chosen && step.storeTo && chosen.value !== undefined) {
              setAnswers((a) => ({ ...a, [step.storeTo as string]: chosen.value as string }));
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
  const isSelect = step.field.type === "select";
  if (step.field.type === "boolean") {
    const boolVal = Boolean((answers[step.field.name] as boolean | undefined) ?? step.field.defaultValue ?? false);
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
          onBack={step.allowBack ? () => back() : undefined}
          preview={
            preview !== undefined ? (
              <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text>
            ) : undefined
          }
        />
      </WizardShell>
    );
  }
  const v =
    step.field.type === "text" || step.field.type === "number"
      ? String((answers[step.field.name] as string | undefined) ?? step.field.defaultValue ?? "")
      : "";
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
        onBack={step.allowBack ? () => back() : undefined}
        preview={
          preview !== undefined ? (
            <Text>{typeof preview === "string" ? preview : JSON.stringify(preview, null, 2)}</Text>
          ) : undefined
        }
      />
      {isSelect && descriptionLines.length > 0 && (
        <Box paddingTop={1}>
          <Text color="gray">{descriptionLines.join("\n")}</Text>
        </Box>
      )}
    </WizardShell>
  );
}

function MultiFieldForm({
  fields,
  answers,
  onChange,
  onNext,
  onBack,
}: {
  fields: (Field | { type: "group"; label: string })[];
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
      let i = selected - 1;
      while (i >= 0 && (fields[i] as any).type === "group") i--;
      return i < 0 ? selected : i;
    })();
    const nextIdx = (() => {
      let i = selected + 1;
      while (i < fields.length && (fields[i] as any).type === "group") i++;
      return i >= fields.length ? selected : i;
    })();
    if (key.upArrow) setSelected(prevIdx);
    if (key.downArrow) setSelected(nextIdx);
    const lastIdx = (() => {
      for (let i = fields.length - 1; i >= 0; i--) if ((fields[i] as any).type !== "group") return i;
      return 0;
    })();
    if (key.downArrow && selected === lastIdx) setActionsFocus(true);
    if (key.return && (fields[selected] as any).type !== "group") setMode("edit");
  });

  // const f = fields[selected]; // unused
  const leftWidth = 28;

  const exitEdit = () => setMode("list");

  return (
    <Box flexDirection="column">
      {fields.map((it, i) => {
        const isSelected = i === selected;
        const isEditing = isSelected && mode === "edit";
        const highlight = !actionsFocus && isSelected; // clear highlight when action bar has focus
        const lineColor: "white" | "gray" = actionsFocus ? "gray" : "white";
        if ((it as any).type === "group") {
          return (
            <Box key={`group:${(it as any).label}`} flexDirection="row" marginTop={1} marginBottom={0}>
              <Text color="cyan">{(it as any).label}</Text>
            </Box>
          );
        }
        const rawVal = (answers[(it as Field).name] as string | number | boolean | undefined) ?? (it as any).defaultValue;
        // derive display value for passive view
        let display: string = "";
        if ((it as Field).type === "select") {
          const found = ((it as any).options ?? []).find((o: any) => o.value === rawVal);
          display = found ? found.label : String(rawVal ?? "");
        } else if ((it as Field).type === "boolean") {
          display = String(Boolean(rawVal));
        } else {
          display = String(rawVal ?? "");
        }
        return (
          <Box key={(it as Field).name} flexDirection="row" marginBottom={0}>
            <Box width={leftWidth} marginRight={1}>
              <Text inverse={highlight}>{(it as Field).label}</Text>
            </Box>
            <Box width={1}>
              <Text color={lineColor}>│</Text>
            </Box>
            <Box flexGrow={1}>
              {isEditing ? (
                (it as Field).type === "select" ? (
                  <SelectInput
                    items={((it as any).options ?? []).map((o: any, idx: number) => ({ ...o, key: `${o.value}:${idx}` }))}
                    isFocused={true}
                    onSelect={(sel: { label: string; value: string }) => {
                      onChange((it as Field).name, sel.value);
                      exitEdit();
                    }}
                  />
                ) : (it as Field).type === "boolean" ? (
                  <SelectInput
                    items={[{ label: "No", value: "false" }, { label: "Yes", value: "true" }]}
                    isFocused={true}
                    onSelect={(sel) => {
                      onChange((it as Field).name, sel.value === "true");
                      exitEdit();
                    }}
                  />
                ) : (
                  <TextInput
                    value={String(rawVal ?? "")}
                    focus={true}
                    onChange={(v) => onChange((it as Field).name, (it as Field).type === "number" ? Number(v) : v)}
                    onSubmit={exitEdit}
                  />
                )
              ) : (
                <Text inverse={highlight}>{display}</Text>
              )}
              {isEditing && <EscCatcher onEsc={exitEdit} />}
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
