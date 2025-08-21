/**
 * @file Home screen component
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { useNavigation } from "../../../routing";

type Choice = { label: string; value: string };

/** Home screen offering navigation to features and exit. */
export function Home() {
  const { navigate } = useNavigation();
  const items: Choice[] = useMemo(
    () => [
      { label: "Open Database Explorer", value: "/database" },
      { label: "Create Config (Wizard)", value: "/wizard" },
      { label: "Settings", value: "/settings" },
      { label: "Help", value: "/help" },
      { label: "Exit", value: "__exit__" },
    ],
    [],
  );
  return (
    <Box flexDirection="column">
      <Text color="magentaBright">VectorDB CLI</Text>
      <Text color="gray">Databases • Search • Manage</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(i: Choice) => {
            if (i.value === "__exit__") process.exit(0);
            navigate(i.value);
          }}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Shortcuts: h=Home  b=Back  ?=Help  q=Quit</Text>
      </Box>
    </Box>
  );
}
