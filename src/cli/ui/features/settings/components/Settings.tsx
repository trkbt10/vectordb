/**
 * @file Settings screen component
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/** Placeholder settings screen with a Back action. */
export function Settings({ onBack }: { onBack: () => void }) {
  // Placeholder for future settings (e.g., registry path, defaults)
  return (
    <Box flexDirection="column">
      <Text color="cyan">Settings</Text>
      <Text color="gray">No settings available yet.</Text>
      <Box marginTop={1}>
        <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
      </Box>
    </Box>
  );
}
