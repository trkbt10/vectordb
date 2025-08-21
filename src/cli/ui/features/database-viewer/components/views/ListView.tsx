/**
 * @file List view component for displaying database items
 */
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ClusterCtx } from "../types";

type ListViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * ListView
 * Why: view a snapshot of current records without leaving the CLI.
 */
export function ListView({ ctx, onBack }: ListViewProps) {
  const [items, setItems] = useState<Array<{ id: number; meta: unknown }>>([]);
  useEffect(() => {
    const s = ctx.client.state;
    const out: Array<{ id: number; meta: unknown }> = [];
    for (let i = 0; i < s.store._count; i++) out.push({ id: s.store.ids[i], meta: s.store.metas[i] });
    setItems(out);
  }, [ctx]);
  return (
    <Box flexDirection="column">
      <Text color="cyan">Items ({items.length})</Text>
      {items.slice(0, 50).map((r) => (
        <Text key={r.id}>
          • {r.id} — {JSON.stringify(r.meta)}
        </Text>
      ))}
      {items.length > 50 && <Text color="gray">… showing first 50</Text>}
      <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
    </Box>
  );
}

