/**
 * @file UI components for OpenAI embeddings scenario
 */

import { Box, Text } from "ink";
import React from "react";

export function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan">◆ {title}</Text>
      <Box marginLeft={2} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

export function Row({ label, value, ok }: { label: string; value?: string; ok?: boolean }) {
  return (
    <Box>
      <Text color={ok ? "green" : "yellow"}>{ok ? "✔" : "…"} </Text>
      <Text>{label}</Text>
      {value ? <Text> — {value}</Text> : null}
    </Box>
  );
}