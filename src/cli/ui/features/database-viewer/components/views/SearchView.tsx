/**
 * @file Search view component for vector similarity search
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type { ClusterCtx } from "../types";

type SearchViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * SearchView
 * Why: quick vector search to validate data and configuration.
 */
export function SearchView({ ctx, onBack }: SearchViewProps) {
  const [vec, setVec] = useState<string>("");
  const [k, setK] = useState<string>("5");
  const [out, setOut] = useState<Array<{ id: number; score: number; meta: unknown }>>([]);
  return (
    <Box flexDirection="column">
      <Text>Query vector (comma-separated floats):</Text>
      <TextInput value={vec} onChange={setVec} />
      <Text>k:</Text>
      <TextInput value={k} onChange={setK} />
      <SelectInput
        items={[
          { label: "Run", value: "run" },
          { label: "Back", value: "back" },
        ]}
        onSelect={async (i: { label: string; value: string }) => {
          if (i.value === "back") {
            return onBack();
          }
          const db = ctx.client;
          const arr = new Float32Array(
            vec
              .split(",")
              .map((x) => Number(x.trim()))
              .filter((x) => !Number.isNaN(x)),
          );
          const res = await db.findMany(arr, { k: Number(k) || 5 });
          setOut(res.map((h) => ({ id: h.id, score: h.score, meta: h.meta })));
        }}
      />
      {out.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">Results</Text>
          {out.map((h) => (
            <Text key={h.id}>
              • {h.id} — {h.score.toFixed(3)} — {JSON.stringify(h.meta)}
            </Text>
          ))}
        </Box>
      )}
      <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
    </Box>
  );
}
