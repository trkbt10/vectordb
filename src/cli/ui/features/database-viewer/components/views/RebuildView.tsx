/**
 * @file Rebuild view component for rebuilding database state
 */
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ClusterCtx } from "../types";
import { buildHNSWFromStore, buildIVFFromStore } from "../../../../../../attr/ops/core";

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
        const target = ctx.selectedStrategy;
        if (target && target !== ctx.client.state.strategy) {
          const rebuilt = ((): typeof ctx.client.state => {
            if (target === "hnsw") return buildHNSWFromStore(ctx.client.state) as typeof ctx.client.state;
            if (target === "ivf") return buildIVFFromStore(ctx.client.state) as typeof ctx.client.state;
            return ctx.client.state;
          })();
          // persist new state (updates catalog: strategy) and include ANN payload
          await ctx.client.index.saveState(rebuilt, { baseName: ctx.name, includeAnn: true });
          // swap in-memory state so Stats reflects change
          ctx.client.state = rebuilt as typeof ctx.client.state;
          setMsg(`Rebuilt with strategy: ${target}.`);
          return;
        }
        const fresh = await ctx.client.index.rebuildState({ baseName: ctx.name });
        const finalized = ((): typeof fresh => {
          if (fresh.strategy === "hnsw") return buildHNSWFromStore(fresh) as typeof fresh;
          if (fresh.strategy === "ivf") return buildIVFFromStore(fresh) as typeof fresh;
          return fresh;
        })();
        // Save with ANN embedded for future fast open
        await ctx.client.index.saveState(finalized, { baseName: ctx.name, includeAnn: true });
        ctx.client.state = finalized as typeof ctx.client.state;
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
