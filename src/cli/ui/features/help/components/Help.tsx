/**
 * @file Help screen component
 */
import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/** Display brief usage help and provide a Back action. */
export function Help({ onBack }: { onBack: () => void }) {
  const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
  const rows = process.stdout?.rows ? Math.max(12, process.stdout.rows) : 24;
  return (
    <Box flexDirection="column" width={cols} height={rows - 4} alignItems="center" justifyContent="center">
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
    </Box>
  );
}
