/**
 * @file Database entry: initial flow to open or create a config
 */
import React, { Suspense, useEffect, useState } from "react";
import { defaultConfigResource } from "../../../../../config";
import { Box, Text } from "ink";
import { DatabaseForm } from "./DatabaseForm";
import type { OpenInput } from "./types";
import { ModeSelector } from "../../database-wizard/components/ModeSelector";
import { Runner } from "../../database-wizard/components/Runner";
import type { FlowSchema } from "../../database-wizard/components/FlowWizard";

type EntryStep = { id: "checking" } | { id: "menu" } | { id: "form" } | { id: "wizard" };

function AutoOpen({ onSubmit }: { onSubmit: (input: OpenInput) => void }) {
  const res = defaultConfigResource();
  const path = res.read();
  useEffect(() => {
    if (path) {
      onSubmit({ kind: "config", path });
    }
  }, [path, onSubmit]);
  return null;
}

/**
 * DatabaseEntry
 */
export function DatabaseEntry({
  onSubmit,
  onExit,
  configFlow,
}: {
  onSubmit: (input: OpenInput) => void;
  onExit: () => void;
  configFlow?: FlowSchema;
}) {
  const [step, setStep] = useState<EntryStep>({ id: "menu" });

  // Suspense gate for auto-open; if no config, it resolves to null and UI remains on menu
  // Fallback provides a brief "Checking configuration..." message during initial probe.

  const suspenseGate = (
    <Suspense
      fallback={
        <Box>
          <Text color="gray">Checking configuration...</Text>
        </Box>
      }
    >
      <AutoOpen onSubmit={onSubmit} />
    </Suspense>
  );

  if (step.id === "menu") {
    return (
      <>
        {suspenseGate}
        <ModeSelector
          canCreate={!!configFlow}
          onChoose={(mode) =>
            setStep(mode === "open" ? { id: "form" } : mode === "exit" ? (onExit(), { id: "menu" }) : { id: "wizard" })
          }
        />
      </>
    );
  }

  if (step.id === "wizard") {
    if (!configFlow) {
      return (
        <Box flexDirection="column">
          <Text color="red">No flow provided</Text>
        </Box>
      );
    }
    return (
      <Runner
        flow={configFlow}
        onCancel={() => setStep({ id: "menu" })}
        onSaved={(p) => onSubmit({ kind: "config", path: p })}
      />
    );
  }

  // form
  return <DatabaseForm onSubmit={onSubmit} onExit={onExit} />;
}
