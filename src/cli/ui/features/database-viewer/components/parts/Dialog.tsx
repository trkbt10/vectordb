/**
 * @file Dialog: centered overlay dialog with subtle bottom-right shadow
 */
import React from "react";
import { Box, Text } from "ink";

/**
 * Dialog: centered modal container with a subtle shadow hint.
 */
export function Dialog({
  open,
  title,
  width = 60,
  children,
}: {
  open: boolean;
  title?: string;
  width?: number;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }
  const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
  const rows = process.stdout?.rows ? Math.max(10, process.stdout.rows) : 24;
  const w = Math.min(width, Math.max(40, cols - 6));
  const titleNode = (() => {
    if (!title) {
      return null;
    }
    return (
      <Box marginBottom={1}>
        <Text color="white">{title}</Text>
      </Box>
    );
  })();
  return (
    <Box position="absolute" width={cols} height={rows} flexDirection="column" alignItems="center" justifyContent="center">
      {/* Shadow + Card: stack to simulate bottom-right drop shadow */}
      <Box flexDirection="column">
        {/* Dialog card */}
        <Box borderStyle="round" paddingX={1} paddingY={0} width={w} flexDirection="column" backgroundColor="black">
          {titleNode}
          {children}
        </Box>
        {/* Bottom shadow bar */}
        <Box marginTop={0}>
          <Text color="gray">{" ".repeat(Math.max(0, w))}</Text>
        </Box>
      </Box>
    </Box>
  );
}
