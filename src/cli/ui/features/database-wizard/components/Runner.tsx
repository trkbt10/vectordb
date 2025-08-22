/**
 * @file Runner: Thin runner that executes a provided FlowSchema.
 * The schema must be injected via props from a higher level.
 */
import React from "react";
import { FlowWizard, type FlowSchema } from "./FlowWizard";

/**
 * Runner: Executes the provided FlowSchema and reports saved path.
 */
export function Runner({
  flow,
  onCancel,
  onSaved,
}: {
  flow: FlowSchema;
  onCancel: () => void;
  onSaved: (path: string) => void;
}) {
  return <FlowWizard schema={flow} onCancel={onCancel} onSaved={onSaved} />;
}
