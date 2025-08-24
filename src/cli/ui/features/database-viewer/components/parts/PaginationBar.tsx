/**
 * @file PaginationBar: bottom bar under the table with page summary and hints
 */
import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../../ThemeContext";

/** Render a full-width page summary and navigation hints. */
export function PaginationBar({
  from,
  to,
  total,
  isFocused = false,
}: {
  from: number;
  to: number;
  total: number;
  isFocused?: boolean;
}) {
  const { theme } = useTheme();
  const left = `${from}-${to} of ${total}`;
  return (
    <Box justifyContent="space-between" marginTop={1} flexGrow={1}>
      <Text color={isFocused ? theme.pagination.summaryFocused : theme.pagination.summaryIdle}>{left}</Text>
      <Box>
        <Box marginLeft={1} backgroundColor={theme.pagination.chipBg}>
          <Text color="black"> PgUp </Text>
        </Box>
        <Box marginLeft={1} backgroundColor={theme.pagination.chipBg}>
          <Text color="black"> PgDn </Text>
        </Box>
      </Box>
    </Box>
  );
}
