/**
 * @file Database view: open filesystem-backed database and perform actions
 */
import React from "react";
import { DatabaseExplorer } from "./DatabaseExplorer";
import type { FlowSchema } from "../../database-wizard/components/FlowWizard";
import { defaultConfigFlow } from "../../database-wizard/components/flows/defaultConfigFlow";

/**
 * DatabaseView
 * Why: single entry to open a filesystem-backed database and route to DB tools.
 */
/**
 * DatabaseView entry component.
 * Accepts an optional onExit handler from router, currently unused by the Explorer.
 */
export function DatabaseView({ onExit }: { onExit: () => void }) {
  // reference prop to satisfy no-unused-vars until used by explorer shell
  void onExit;
  // Provide a minimal built-in flow so wizard is available even if caller doesn't inject one.
  const defaultFlow: FlowSchema = defaultConfigFlow;

  return <DatabaseExplorer configFlow={defaultFlow} />;
}
