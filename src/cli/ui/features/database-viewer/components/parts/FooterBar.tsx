/**
 * @file FooterBar: single-row footer with status segments and actions
 */
import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../../ThemeContext";

export type FooterAction = { label: string; value: string };

/**
 * FooterBarBase
 * Renders status segments (status/total/showing/page/per) and action chips.
 */
function FooterBarBase({
  status,
  total,
  showing,
  page,
  totalPages,
  per,
  actions,
  focusIndex,
  isFocused = false,
  hovered = false,
}: {
  status: string;
  total: number;
  showing: number;
  page: number;
  totalPages: number;
  per: number;
  actions: FooterAction[];
  focusIndex: number;
  isFocused?: boolean;
  hovered?: boolean;
}) {
  const { theme } = useTheme();
  const seg = React.useCallback(
    (label: string, val: string) => (
      <Box key={label} marginRight={2}>
        <Text>
          <Text color="gray">{label}: </Text>
          <Text color="whiteBright">{val}</Text>
        </Text>
      </Box>
    ),
    [],
  );

  // Preserve original order while grouping for clearer separation
  const entries = actions.map((a, i) => [a, i] as const);
  const find = entries.filter(([a]) => a.value === "search");
  const dbOps = entries.filter(([a]) => a.value !== "search" && a.value !== "pgup" && a.value !== "pgdn");

  const Chip = ({ label, active }: { label: string; active: boolean }) => {
    const padWidth = 14;
    const padded = ` ${label} `.padEnd(padWidth, " ");
    return (
      <Box marginLeft={1} backgroundColor={active ? theme.footer.chipActiveBg : theme.footer.chipIdleBg}>
        <Text color={active ? theme.footer.chipActiveFg : theme.footer.chipIdleFg}>{padded}</Text>
      </Box>
    );
  };

  const Group = ({ title, items }: { title: string; items: (readonly [FooterAction, number])[] }) => {
    if (items.length === 0) {
      return null;
    }
    return (
      <Box>
        <Text color={isFocused ? theme.footer.titleFocused : theme.footer.titleIdle}>{title}:</Text>
        {items.map(([it, originalIdx]) => (
          <Chip key={it.value} label={it.label} active={originalIdx === focusIndex} />
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box justifyContent="space-between" backgroundColor="black">
        <Box>
          {seg("status", status)}
          {seg("total", String(total))}
          {seg("showing", String(showing))}
          {seg("page", `${page}/${totalPages}`)}
          {seg("per", String(per))}
        </Box>
        <Box />
      </Box>
      <Box backgroundColor={isFocused ? "blue" : hovered ? "gray" : undefined} marginTop={1}>
        <Group title="Find" items={find} />
        <Box marginLeft={2} />
        {/* Pagination moved to table bottom; omit here */}
        <Group title="Database" items={dbOps} />
      </Box>
    </Box>
  );
}

export const FooterBar = React.memo(FooterBarBase);
