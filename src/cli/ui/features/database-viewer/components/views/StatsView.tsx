/**
 * @file Stats view component for displaying database statistics
 */
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import type { ClusterCtx } from "../types";
import { Dialog } from "../parts/Dialog";

type StatsViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * StatsView
 * Why: confirm runtime shape (dim/metric/strategy) and record count.
 */
export function StatsView({ ctx, onBack }: StatsViewProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, [ctx]);
  if (!ready)
    return (
      <Text>
        <Spinner type="dots" /> Loading...
      </Text>
    );
  const items = [{ label: "Back", value: "back" }];
  return (
    <Dialog open={true} title="Stats / Diagnose" width={60}>
      <Box flexDirection="column">
        <Text>Dim: {ctx.client.state.dim}</Text>
        <Text>Metric: {ctx.client.state.metric}</Text>
        <Text>Strategy: {ctx.client.state.strategy}</Text>
        <Text>Count: {ctx.client.size}</Text>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={() => onBack()} />
        </Box>
      </Box>
    </Dialog>
  );
}
