/**
 * @file QueryConfigView: displays how to configure query vectorization
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ClusterCtx } from "../types";
import { Dialog } from "../parts/Dialog";

type QueryConfigViewProps = { ctx: ClusterCtx; onBack: () => void };

/**
 * QueryConfigView: shows current method and a sample JSON snippet to set it in config.
 */
export function QueryConfigView({ ctx, onBack }: QueryConfigViewProps) {
  const method = (ctx.query?.method ?? "auto") as "auto" | "numeric" | "hash" | "openai";
  const name = ctx.query?.name ?? (method === "hash" ? "feature-hash" : method);
  const snippet = JSON.stringify(
    {
      query: {
        embed: {
          method,
          name,
          // For OpenAI, set OPENAI_API_KEY in your env (bun --env-file=.env)
          // model: "text-embedding-3-small"
        },
      },
    },
    null,
    2,
  );
  const items = [{ label: "Back", value: "back" }];
  return (
    <Dialog open={true} title="Query Config (Sample)" width={72}>
      <Box flexDirection="column">
        <Text>Method: {method}</Text>
        <Text>Name: {name}</Text>
        <Box marginTop={1}>
          <Text color="gray">Add to your CLI config JSON:</Text>
        </Box>
        <Box>
          <Text>{snippet}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">
            Note: This config is used by CLI operations (open/rebuild/save), not runtime UI state.
          </Text>
        </Box>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={() => onBack()} />
        </Box>
      </Box>
    </Dialog>
  );
}
