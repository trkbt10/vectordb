/**
 * @file DefaultWizard: convenience wrapper to run the default configuration flow.
 */
import React from "react";
import { Box } from "ink";
import { Runner } from "./Runner";
import { defaultConfigFlow } from "./flows/defaultConfigFlow";

/** Run the default configuration wizard and call onDone when finished or canceled. */
export function DefaultWizard({ onDone }: { onDone: () => void }) {
  return (
    <Box flexDirection="column">
      <Runner flow={defaultConfigFlow} onCancel={onDone} onSaved={() => onDone()} />
    </Box>
  );
}
