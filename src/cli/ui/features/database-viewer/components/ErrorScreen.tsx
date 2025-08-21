/**
 * @file Error screen component
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/**
 * ErrorScreen
 * Why: surface errors with a consistent back affordance.
 */
export function ErrorScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <Box flexDirection="column">
      <Text color="red">{message}</Text>
      <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
    </Box>
  );
}

