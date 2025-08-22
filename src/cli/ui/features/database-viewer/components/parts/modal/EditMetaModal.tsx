/**
 * @file EditMetaModal: edit meta JSON for a row
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { Dialog } from "../Dialog";

/**
 * EditMetaModal: 単一行のメタデータ(JSON文字列)を編集・保存するモーダルコンポーネント。
 * 不正な入力検証は外部に委ね、ここではテキストの受け渡しと選択操作のみを扱う。
 */
type KV = { key: string; value: string; type: "string" | "number" | "boolean" | "null" | "object" | "array" };

function detectType(v: unknown): KV["type"] {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") return t;
  if (t === "object") return "object";
  return "string";
}

function parseValue(text: string, want: KV["type"]): { ok: boolean; value: unknown } {
  if (want === "string") return { ok: true, value: text };
  if (want === "number") {
    const n = Number(text);
    return { ok: !Number.isNaN(n), value: n };
  }
  if (want === "boolean") {
    const low = text.toLowerCase();
    if (low === "true" || low === "false") return { ok: true, value: low === "true" };
    return { ok: false, value: false };
  }
  if (want === "null") return { ok: text.trim().toLowerCase() === "null", value: null };
  try {
    const v = JSON.parse(text);
    if (want === "object" && (v === null || Array.isArray(v) || typeof v !== "object")) return { ok: false, value: {} };
    if (want === "array" && !Array.isArray(v)) return { ok: false, value: [] };
    return { ok: true, value: v };
  } catch {
    return { ok: false, value: want === "array" ? [] : {} };
  }
}

/**
 * EditMetaModal: k-v ベースで行メタ(JSON)を編集するモーダル。元の型を維持し、型不一致は警告する。
 */
export function EditMetaModal({
  open,
  initialMetaText,
  onSave,
  onCancel,
  onEditingChange,
}: {
  open: boolean;
  initialMetaText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [rows, setRows] = React.useState<KV[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState<number>(0);
  const [mode, setMode] = React.useState<"list" | "edit">("list");
  const [actionsFocus, setActionsFocus] = React.useState<boolean>(false);
  React.useEffect(() => {
    try {
      const json = JSON.parse(initialMetaText) as unknown;
      const obj = (json && typeof json === "object" && !Array.isArray(json)) ? (json as Record<string, unknown>) : {};
      const kvs = Object.keys(obj).map((k) => ({ key: k, value: JSON.stringify(obj[k]), type: detectType(obj[k]) })) as KV[];
      setRows(kvs);
      setErrors({});
      setSelected(0);
      setMode("list");
      setActionsFocus(false);
    } catch {
      setRows([]);
      setErrors({ __root: "Invalid JSON" });
    }
  }, [initialMetaText]);
  useInput((input, key) => {
    if (mode === "edit") return;
    if (actionsFocus) {
      if (key.upArrow) setActionsFocus(false);
      return;
    }
    const prevIdx = selected > 0 ? selected - 1 : selected;
    const nextIdx = selected < Math.max(0, rows.length - 1) ? selected + 1 : selected;
    if (key.upArrow) setSelected(prevIdx);
    if (key.downArrow) setSelected(nextIdx);
    const lastIdx = Math.max(0, rows.length - 1);
    if (key.downArrow && selected === lastIdx) setActionsFocus(true);
    if (key.return && rows.length > 0) {
      setMode("edit");
      onEditingChange?.(true);
    }
  });
  const exitEdit = () => setMode("list");
  React.useEffect(() => {
    if (mode === "list") onEditingChange?.(false);
  }, [mode, onEditingChange]);
  if (!open) return null;
  function editorFor(r: KV, idx: number, isEditing: boolean): React.ReactNode {
    if (!isEditing) return <Text>{r.value}</Text>;
    if (r.type === "boolean") {
      return (
        <SelectInput
          isFocused={true}
          items={[{ label: "false", value: "false" }, { label: "true", value: "true" }]}
          onSelect={(i: { value: string }) => {
            const next = rows.slice();
            next[idx] = { ...r, value: i.value };
            setRows(next);
            exitEdit();
          }}
        />
      );
    }
    return (
      <TextInput
        value={r.value}
        focus={true}
        onChange={(v) => {
          const next = rows.slice();
          next[idx] = { ...r, value: v };
          setRows(next);
        }}
        onSubmit={exitEdit}
      />
    );
  }
  return (
    <Dialog open={true} title="Edit Meta" width={60}>
      {rows.length === 0 && (
        <Box>
          <Text color="red">{errors.__root ? errors.__root : "No object meta to edit"}</Text>
        </Box>
      )}
      {rows.map((r, idx) => {
        const isSelected = idx === selected;
        const isEditing = isSelected ? mode === "edit" : false;
        const highlight = actionsFocus ? false : isSelected;
        const label = <Text inverse={highlight}>{r.key}</Text>;
        const type = <Text color="gray">{r.type}</Text>;
        const status = (() => {
          const parsed = parseValue(r.value, r.type);
          if (!parsed.ok) return <Text color="yellow"> type mismatch </Text>;
          return <Text color="gray"> ok </Text>;
        })();
        return (
          <Box key={r.key}>
            <Box width={16}>{label}</Box>
            <Box width={10}>{type}</Box>
            <Box flexGrow={1}>
              {editorFor(r, idx, isEditing)}
              {isEditing ? <EscCatcher onEsc={exitEdit} /> : null}
            </Box>
            <Box marginLeft={1}>{status}</Box>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <SelectInput
          isFocused={actionsFocus}
          items={[{ label: "Save", value: "save" }, { label: "Cancel", value: "cancel" }]}
          onSelect={(i: { value: string }) => {
            if (i.value === "cancel") return onCancel();
            const obj: Record<string, unknown> = {};
            for (const r of rows) {
              const p = parseValue(r.value, r.type);
              if (!p.ok) {
                setErrors((e) => ({ ...e, [r.key]: "type mismatch" }));
                return;
              }
              obj[r.key] = p.value;
            }
            onSave(JSON.stringify(obj, null, 2));
          }}
        />
      </Box>
    </Dialog>
  );
}

function EscCatcher({ onEsc }: { onEsc: () => void }) {
  useInput((input, key) => {
    if (key.escape) onEsc();
  });
  return <></>;
}
