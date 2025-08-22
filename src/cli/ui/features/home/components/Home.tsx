/**
 * @file Home screen component
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { Logo } from "../../../components/ui";
import { useNavigation } from "../../../routing";

type Choice = { label: string; value: string };

/** Home screen offering navigation to features and exit. */
export function Home() {
  const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
  const rows = process.stdout?.rows ? Math.max(12, process.stdout.rows) : 24;
  const { navigate } = useNavigation();
  const items: Choice[] = useMemo(
    () => [
      { label: "Open Database Explorer", value: "/database" },
      { label: "Create Config (Wizard)", value: "/wizard" },
      { label: "Help", value: "/help" },
      { label: "Exit", value: "__exit__" },
    ],
    [],
  );
  return (
    <Box flexDirection="column" width={cols} height={rows - 4} alignItems="center" justifyContent="center">
      <Logo />
      <Box marginTop={1}>
        <Text color="gray">Databases • Search • Manage</Text>
      </Box>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(i: Choice) => {
            if (i.value === "__exit__") {
              process.exit(0);
            }
            navigate(i.value);
          }}
        />
      </Box>
    </Box>
  );
}
