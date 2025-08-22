/**
 * @file Settings screen component
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/** Placeholder settings screen with a Back action. */
export function Settings({ onBack }: { onBack: () => void }) {
  // Placeholder for future settings (e.g., registry path, defaults)
  const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
  const rows = process.stdout?.rows ? Math.max(12, process.stdout.rows) : 24;
  return (
    <Box flexDirection="column" width={cols} height={rows - 4} alignItems="center" justifyContent="center">
      <Box flexDirection="column">
        <Text color="cyan">Settings</Text>
        <Text color="gray">No settings available yet.</Text>
        <Box marginTop={1}>
          <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
        </Box>
      </Box>
    </Box>
  );
}
