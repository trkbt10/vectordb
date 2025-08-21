/**
 * @file Filter view component for metadata filtering
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type { ClusterCtx } from "../types";

type FilterViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * FilterView
 * Why: simple meta equality filter for quick inspection.
 */
export function FilterView({ ctx, onBack }: FilterViewProps) {
  const [key, setKey] = useState<string>("");
  const [val, setVal] = useState<string>("");
  const [out, setOut] = useState<number[]>([]);
  return (
    <Box flexDirection="column">
      <Text>Filter key:</Text>
      <TextInput value={key} onChange={setKey} />
      <Text>Equals value (string):</Text>
      <TextInput value={val} onChange={setVal} />
      <SelectInput
        items={[
          { label: "Run", value: "run" },
          { label: "Back", value: "back" },
        ]}
        onSelect={async (i: { label: string; value: string }) => {
          if (i.value === "back") return onBack();
          const s = ctx.client.state;
          const ids: number[] = [];
          for (let i = 0; i < s.store._count; i++) {
            const id = s.store.ids[i];
            const meta = s.store.metas[i] as unknown;
            if (meta && typeof meta === "object" && meta !== null) {
              const rec = meta as Record<string, unknown>;
              if (String(rec[key]) === val) ids.push(id);
            }
          }
          setOut(ids);
        }}
      />
      {out.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">Matched IDs</Text>
          <Text>{out.join(", ")}</Text>
        </Box>
      )}
      <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
    </Box>
  );
}

