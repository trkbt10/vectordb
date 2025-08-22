/**
 * @file ModeSelector: choose how to proceed when no config file exists
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/**
 * ModeSelector: Choose flow creation or open; creation only shown when a flow is injected.
 */
export function ModeSelector({
  onChoose,
  canCreate,
}: {
  onChoose: (mode: "create" | "open" | "exit") => void;
  canCreate: boolean;
}) {
  const items: { label: string; value: "create" | "open" | "exit" }[] = [
    ...(canCreate ? [{ label: "Create Config", value: "create" as const }] : []),
    { label: "Open Database", value: "open" },
    { label: "Exit", value: "exit" },
  ];

  return (
    <Box flexDirection="column">
      <Text color="cyan">No config detected</Text>
      <Text>Select how to proceed:</Text>
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={(i) => onChoose(i.value)} />
      </Box>
    </Box>
  );
}
