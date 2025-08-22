/**
 * @file Delete view: remove a row by ID
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type { ClusterCtx } from "../types";

type DeleteViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * DeleteView
 * Why: quick removal of a record by ID without leaving the CLI.
 */
export function DeleteView({ ctx, onBack }: DeleteViewProps) {
  const [id, setId] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  return (
    <Box flexDirection="column">
      <Text>ID (number):</Text>
      <TextInput value={id} onChange={setId} />
      <SelectInput
        items={[
          { label: "Delete", value: "delete" },
          { label: "Back", value: "back" },
        ]}
        onSelect={(i: { label: string; value: string }) => {
          if (i.value === "back") {
            return onBack();
          }
          try {
            const rid = Number(id);
            const ok = ctx.client.delete(rid);
            setMsg(ok ? "Deleted" : "Not found");
          } catch (e) {
            const m = (e as { message?: unknown })?.message;
            setMsg(`Error: ${String(m ?? e)}`);
          }
        }}
      />
      {msg && (
        <Box marginTop={1}>
          <Text>{msg}</Text>
        </Box>
      )}
      <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
    </Box>
  );
}
