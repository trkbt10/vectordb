/**
 * @file Upsert view: add or update a row
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type { ClusterCtx } from "../types";

type UpsertViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * UpsertView
 * Why: add or update a record (vector + meta) in-place.
 */
export function UpsertView({ ctx, onBack }: UpsertViewProps) {
  const [id, setId] = useState<string>("");
  const [vec, setVec] = useState<string>("");
  const [meta, setMeta] = useState<string>("{}");
  const [msg, setMsg] = useState<string>("");

  return (
    <Box flexDirection="column">
      <Text>ID (number):</Text>
      <TextInput value={id} onChange={setId} />
      <Text>Vector (comma-separated floats):</Text>
      <TextInput value={vec} onChange={setVec} />
      <Text>Meta (JSON or null):</Text>
      <TextInput value={meta} onChange={setMeta} />
      <SelectInput
        items={[
          { label: "Upsert", value: "upsert" },
          { label: "Back", value: "back" },
        ]}
        onSelect={(i: { label: string; value: string }) => {
          if (i.value === "back") return onBack();
          try {
            const rid = Number(id);
            const arr = new Float32Array(
              vec
                .split(",")
                .map((x) => Number(x.trim()))
                .filter((x) => !Number.isNaN(x)),
            );
            const m = meta.trim().toLowerCase() === "null" ? null : (JSON.parse(meta) as unknown);
            ctx.client.set(rid, { vector: arr, meta: m }, { upsert: true });
            setMsg("OK");
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

