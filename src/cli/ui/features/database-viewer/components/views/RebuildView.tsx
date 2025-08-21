/**
 * @file Rebuild view component for rebuilding database state
 */
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ClusterCtx } from "../types";

type RebuildViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * RebuildView
 * Why: regenerate derived ANN or index artifacts from the persisted data layout.
 */
export function RebuildView({ ctx, onBack }: RebuildViewProps) {
  const [msg, setMsg] = useState<string>("Rebuilding from data...");
  useEffect(() => {
    (async () => {
      try {
        await ctx.client.index.rebuildState({ baseName: ctx.name });
        setMsg("Rebuilt successfully.");
      } catch (e) {
        const m = (e as { message?: unknown })?.message;
        setMsg(`Error: ${String(m ?? e)}`);
      }
    })();
  }, [ctx]);
  return (
    <Box flexDirection="column">
      <Text>{msg}</Text>
      <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
    </Box>
  );
}

