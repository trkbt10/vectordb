/**
 * @file Minimal UI primitives for consistent CLI styling
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";

/** Render a cyan title with optional gray subtitles. */
export function Title({ label, subtitle }: { label: string; subtitle?: string | string[] }) {
  const subs = Array.isArray(subtitle) ? subtitle : subtitle ? [subtitle] : [];
  return (
    <Box flexDirection="column">
      <Text color="cyan">{label}</Text>
      {subs.map((s, i) => (
        <Text key={i} color="gray">
          {s}
        </Text>
      ))}
    </Box>
  );
}

/** Render a horizontal line fitting the terminal width (approx). */
export function HLine({
  width,
  char = "─",
  color = "gray" as const,
}: {
  width?: number;
  char?: string;
  color?: "gray" | "cyan" | "yellow" | "magenta";
}) {
  const cols = width ?? (process.stdout?.columns ? Math.max(8, process.stdout.columns - 4) : 60);
  return <Text color={color}>{char.repeat(cols)}</Text>;
}

/** Render breadcrumb text (not heavily used now). */
export function Breadcrumbs({ items }: { items: string[] }) {
  return <Text color="gray">{items.filter(Boolean).join(" › ")}</Text>;
}

/** Render a gray hint line. */
export function Hint({ children }: { children: string }) {
  return <Text color="gray">{children}</Text>;
}

/**
 * Render a large ASCII logo.
 */
export function Logo() {
  const art = [
    " __     __          _            ____  ____  ",
    " \\ \\   / /__  _ __| |_ ___ _ __| __ )| __ ) ",
    "  \\ \\ / / _ \\| '__| __/ _ \\ '__|  _ \\  _ \\ ",
    "   \\ V / (_) | |  | ||  __/ |  | |_) | |_) |",
    "    \\_/ \\___/|_|   \\__\\___|_|  |____/|____/ ",
  ];
  return (
    <Box flexDirection="column" alignItems="center">
      {art.map((line, i) => (
        <Text key={i} color="magentaBright">
          {line}
        </Text>
      ))}
    </Box>
  );
}

/** Full-screen wizard chrome with sidebar steps and footer hints. */
export function WizardShell({
  title,
  steps,
  currentId,
  children,
  footer,
}: {
  title: string;
  steps: { id: string; label: string }[];
  currentId: string;
  children: React.ReactNode;
  footer?: string;
}) {
  const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
  const rows = process.stdout?.rows ? Math.max(12, process.stdout.rows) : 24;
  const contentWidth = Math.min(80, Math.max(40, cols - 10));
  void currentId;
  return (
    <Box flexDirection="column" width={cols} height={rows - 4}>
      {/* Top bar */}
      <Box justifyContent="center">
        <Text color="cyan">{title}</Text>
      </Box>
      <Box justifyContent="center">
        <HLine width={contentWidth} />
      </Box>
      {/* Body */}
      <Box flexDirection={steps.length > 0 ? "row" : "column"}>
        {steps.length > 0 && (
          <>
            <Box width={28} flexDirection="column">
              <Text color="gray">Steps</Text>
              <Text color="gray">────────────────────────</Text>
              {steps.map((s, i) => (
                <Text key={`${i}:${s.id}`} inverse={s.id === currentId}>
                  {s.label}
                </Text>
              ))}
            </Box>
            <Box width={1}>
              <Text color="gray">│</Text>
            </Box>
          </>
        )}
        {/* Main panel */}
        <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
          <Box width={contentWidth} flexDirection="column">
            {children}
          </Box>
        </Box>
      </Box>
      <Box justifyContent="center">
        <HLine width={contentWidth} />
      </Box>
      {footer && (
        <Box justifyContent="center">
          <Hint>{footer}</Hint>
        </Box>
      )}
    </Box>
  );
}

/** Generic question form supporting text/number/select/boolean with a horizontal action bar. */
export function QuestionForm({
  field,
  value,
  onChange,
  onNext,
  onBack,
  preview,
}: {
  field: {
    type: "text" | "number" | "select" | "boolean";
    name: string;
    label: string;
    options?: { label: string; value: string }[];
  };
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean) => void;
  onNext: () => void;
  onBack?: () => void;
  preview?: React.ReactNode;
}) {
  const [focus, setFocus] = React.useState<"field" | "actions">("field");
  useInput((input, key) => {
    if (key.upArrow || key.downArrow) setFocus((f) => (f === "field" ? "actions" : "field"));
  });
  return (
    <Box flexDirection="column">
      {preview}
      {field.type === "select" ? (
        <>
          <Text>{field.label}</Text>
          {/* For options, still use ink-select-input for reliability */}
          <SelectInput
            items={[
              ...((field.options ?? []).map((o, idx) => ({ ...o, key: `${o.value}:${idx}` })) as {
                label: string;
                value: string;
                key: string;
              }[]),
              ...((onBack ? [{ key: "__back__", label: "Back", value: "__back__" }] : []) as {
                label: string;
                value: string;
                key: string;
              }[]),
            ]}
            isFocused={focus === "field"}
            onSelect={(i: { label: string; value: string }) => {
              if (i.value === "__back__") return onBack?.();
              onChange(i.value);
            }}
          />
          <ActionBar
            items={[{ label: "Next", value: "__next" }, ...(onBack ? [{ label: "Back", value: "__back" }] : [])]}
            focus={focus === "actions"}
            onSelect={(val) => (val === "__back" ? onBack?.() : onNext())}
          />
        </>
      ) : field.type === "boolean" ? (
        <>
          <Text>{field.label}</Text>
          <ActionBar
            items={[
              { label: (value ? "Yes" : "No") + " (toggle)", value: "__toggle" },
              { label: "Next", value: "__next" },
              ...(onBack ? [{ label: "Back", value: "__back" }] : []),
            ]}
            focus={true}
            onSelect={(val) =>
              val === "__toggle" ? onChange(!(value as boolean)) : val === "__back" ? onBack?.() : onNext()
            }
          />
        </>
      ) : (
        <>
          <Text>{field.label}</Text>
          <TextInput value={String(value ?? "")} onChange={(v) => onChange(v)} focus={focus === "field"} />
          <ActionBar
            items={[{ label: "Next", value: "__next" }, ...(onBack ? [{ label: "Back", value: "__back" }] : [])]}
            focus={focus === "actions"}
            onSelect={(val) => (val === "__back" ? onBack?.() : onNext())}
          />
        </>
      )}
    </Box>
  );
}

/**
 * ActionBar: horizontal selectable action buttons navigated with arrows and Enter.
 */
export function ActionBar({
  items,
  focus,
  onSelect,
  initialIndex = 0,
}: {
  items: { label: string; value: string }[];
  focus: boolean;
  onSelect: (value: string) => void;
  initialIndex?: number;
}): React.ReactElement {
  const [idx, setIdx] = React.useState(initialIndex);
  React.useEffect(() => setIdx(initialIndex), [initialIndex, items.length]);
  useInput((input, key) => {
    if (!focus) return;
    if (key.leftArrow) setIdx((i) => (i > 0 ? i - 1 : i));
    if (key.rightArrow) setIdx((i) => (i < items.length - 1 ? i + 1 : i));
    if (key.return) onSelect(items[idx]?.value);
  });
  return (
    <Box>
      {items.map((it, i) => (
        <Box key={it.value} paddingRight={2}>
          <Text inverse={focus && i === idx}>[{it.label}]</Text>
        </Box>
      ))}
    </Box>
  );
}
