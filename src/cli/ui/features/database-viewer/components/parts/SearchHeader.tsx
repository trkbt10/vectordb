/**
 * @file SearchHeader: single row search input with divider
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
// no theme usage here to avoid layout-affecting separators

/**
 * SearchHeaderBase
 * Controlled search input and divider.
 */
function SearchHeaderBase({
  query,
  onChange,
  isFocused = true,
  onEsc,
}: {
  query: string;
  onChange: (v: string) => void;
  isFocused?: boolean;
  onEsc?: () => void;
}) {
  useInput((input, key) => {
    if (!isFocused) {
      return;
    }
    if (key.escape) {
      onEsc?.();
    }
  });
  return (
    <Box flexGrow={1} marginBottom={1}>
      <Text color={isFocused ? "cyan" : undefined}>Search: </Text>
      <TextInput value={query} onChange={onChange} focus={isFocused} />
    </Box>
  );
}

export const SearchHeader = React.memo(SearchHeaderBase);
