/**
 * @file Help screen component
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/** Display brief usage help and provide a Back action. */
export function Help({ onBack }: { onBack: () => void }) {
  return (
    <Box flexDirection="column">
      <Text color="cyan">Help</Text>
      <Text>• Navigate menus with arrows and Enter.</Text>
      <Text>• Shortcuts: h=Home, b=Back, ?=Help, q=Quit.</Text>
      <Text>• Database Explorer lists registry on the left and rows on the right.</Text>
      <Text>• Use the Wizard to create a `vectordb.config.json` quickly.</Text>
      <Box marginTop={1}>
        <SelectInput items={[{ label: "Back", value: "back" }]} onSelect={() => onBack()} />
      </Box>
    </Box>
  );
}
