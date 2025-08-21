/**
 * @file Database form: choose folder inputs or a config file
 */
import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type { OpenInput } from "./types";

/** DatabaseForm: collect either folder settings or a config file path. */
export function DatabaseForm({ onSubmit, onExit }: { onSubmit: (input: OpenInput) => void; onExit: () => void }) {
  const [mode, setMode] = useState<"folder" | "config">("folder");
  const [indexRoot, setIndexRoot] = useState(".vectordb");
  const [dataRoot, setDataRoot] = useState(".vectordb/data");
  const [name, setName] = useState("db");
  const [configPath, setConfigPath] = useState("./vectordb.config.json");

  const items = [
    { label: "Open", value: "open" },
    { label: "Back", value: "back" },
    { label: mode === "folder" ? "Switch to Config File" : "Switch to Folder", value: "switch" },
  ];

  return (
    <Box flexDirection="column">
      <Text color="cyan">Open Database</Text>

      {mode === "folder" ? (
        <>
          <Box>
            <Box width={14}>
              <Text>Index Root:</Text>
            </Box>
            <TextInput value={indexRoot} onChange={setIndexRoot} onSubmit={() => {}} />
          </Box>
          <Box>
            <Box width={14}>
              <Text>Data Root:</Text>
            </Box>
            <TextInput value={dataRoot} onChange={setDataRoot} onSubmit={() => {}} />
          </Box>
          <Box>
            <Box width={14}>
              <Text>Name:</Text>
            </Box>
            <TextInput value={name} onChange={setName} onSubmit={() => {}} />
          </Box>
        </>
      ) : (
        <Box>
          <Box width={14}>
            <Text>Config Path:</Text>
          </Box>
          <TextInput value={configPath} onChange={setConfigPath} onSubmit={() => {}} />
        </Box>
      )}

      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(i: { label: string; value: string }) => {
            if (i.value === "back") return onExit();
            if (i.value === "switch") return setMode(mode === "folder" ? "config" : "folder");
            if (mode === "folder") return onSubmit({ kind: "folder", indexRoot, dataRoot, name });
            return onSubmit({ kind: "config", path: configPath });
          }}
        />
      </Box>
    </Box>
  );
}

