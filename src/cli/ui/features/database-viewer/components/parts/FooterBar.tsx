/**
 * @file FooterBar: single-row footer with status segments and actions
 */
import React from "react";
import { Box, Text } from "ink";

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
}: {
  status: string;
  total: number;
  showing: number;
  page: number;
  totalPages: number;
  per: number;
  actions: FooterAction[];
  focusIndex: number;
}) {
  const seg = React.useCallback(
    (label: string, val: string) => (
      <Box key={label} marginRight={1}>
        <Text color="black">
          {" "}
          {label}: {val}{" "}
        </Text>
      </Box>
    ),
    [],
  );
  return (
    <Box width="100%" justifyContent="space-between" flexDirection="column" backgroundColor="white">
      <Box justifyContent="space-between">
        <Box>
          {seg("status", status)}
          {seg("total", String(total))}
          {seg("showing", String(showing))}
          {seg("page", `${page}/${totalPages}`)}
          {seg("per", String(per))}
        </Box>
        <Box />
      </Box>
      <Box>
        {actions.map((it, i) => {
          const label = ` ${it.label} `;
          const padWidth = 16;
          const padded = label.padEnd(padWidth, " ");
          const active = i === focusIndex;
          return (
            <Box key={it.value} marginLeft={1} backgroundColor={active ? "whiteBright" : "grey"}>
              <Text color={active ? "black" : "black"}>{padded}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export const FooterBar = React.memo(FooterBarBase);
