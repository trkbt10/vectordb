/**
 * @file SearchHeader: single row search input with divider
 */
import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

/**
 * SearchHeaderBase
 * Controlled search input and divider.
 */
function SearchHeaderBase({
  query,
  onChange,
  isFocused = true,
}: {
  query: string;
  onChange: (v: string) => void;
  isFocused?: boolean;
}) {
  return (
    <>
      <Box>
        <Box width="100%" justifyContent="space-between">
          <Box>
            <Text>Search: </Text>
            <TextInput value={query} onChange={onChange} focus={isFocused} />
          </Box>
          <Box />
        </Box>
      </Box>
      <Text color="gray">{"─".repeat(Math.max(40, (process.stdout?.columns ?? 80) - 2))}</Text>
    </>
  );
}

export const SearchHeader = React.memo(SearchHeaderBase);
