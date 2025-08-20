/**
 * @file Database form component for inputting index and data roots
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";

type ClusterFormProps = {
  onSubmit: (indexRoot: string, dataRoot: string) => void;
  onExit: () => void;
};

/**
 * ClusterForm
 * Why: collect minimal IO roots before connecting to a database.
 */
export function ClusterForm({ onSubmit, onExit }: ClusterFormProps) {
  const [indexRoot, setIndexRoot] = useState(".vectordb");
  const [dataRoot, setDataRoot] = useState(".vectordb/data");

  return (
    <Box flexDirection="column">
      <Text color="cyan">Open Database (Filesystem)</Text>
      <Box>
        <Box width={16}>
          <Text>Index Root:</Text>
        </Box>
        <TextInput value={indexRoot} onChange={setIndexRoot} onSubmit={() => {}} />
      </Box>
      <Box>
        <Box width={16}>
          <Text>Data Root:</Text>
        </Box>
        <TextInput value={dataRoot} onChange={setDataRoot} onSubmit={() => {}} />
      </Box>
      <Box marginTop={1}>
        <Text color="yellow">Press Enter to proceed, or Esc to return.</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text color="green">[Open]</Text> index: {indexRoot} | data: {dataRoot}
        </Text>
      </Box>
      <Box marginTop={1}>
        <SelectInput
          items={[
            { label: "Open", value: "open" },
            { label: "Back", value: "back" },
          ]}
          onSelect={(i: { label: string; value: string }) =>
            i.value === "open" ? onSubmit(indexRoot, dataRoot) : onExit()
          }
        />
      </Box>
    </Box>
  );
}
