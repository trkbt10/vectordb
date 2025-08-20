/**
 * @file Root CLI app (menu + routing)
 */
import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { DatabaseView } from "./DatabaseView";

type Screen = { id: "menu" } | { id: "database" };

/**
 * Root CLI application (menu + routing)
 */
export function App() {
  const [screen, setScreen] = useState<Screen>({ id: "menu" });

  type Choice = { label: string; value: string };
  const items: Choice[] = useMemo(
    () => [
      { label: "Open Database (FS)", value: "open" },
      { label: "Exit", value: "exit" },
    ],
    [],
  );

  if (screen.id === "database") {
    return <DatabaseView onExit={() => setScreen({ id: "menu" })} />;
  }

  return (
    <Box flexDirection="column">
      <Text color="magentaBright">VectorDB CLI</Text>
      <Text color="gray">Inspect, search, edit, rebuild</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(i: Choice) => {
            if (i.value === "open") setScreen({ id: "database" });
            if (i.value === "exit") process.exit(0);
          }}
        />
      </Box>
    </Box>
  );
}
