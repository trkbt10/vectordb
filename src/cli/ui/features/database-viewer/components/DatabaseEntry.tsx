/**
 * @file Database entry: initial flow to open or create a config
 */
import React, { useEffect, useState } from "react";
import { access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { Box, Text } from "ink";
import { DatabaseForm } from "./DatabaseForm";
import type { OpenInput } from "./types";
import { ModeSelector } from "../../database-wizard/components/ModeSelector";
import { Runner } from "../../database-wizard/components/Runner";
import type { FlowSchema } from "../../database-wizard/components/FlowWizard";

type EntryStep = { id: "checking" } | { id: "menu" } | { id: "form" } | { id: "wizard" };

const DEFAULT_CONFIG_PATH = "./vectordb.config.json";

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
  const [step, setStep] = useState<EntryStep>({ id: "checking" });

  useEffect(() => {
    (async () => {
      try {
        await access(DEFAULT_CONFIG_PATH, FS.F_OK);
        // Auto-open using the default config when present
        onSubmit({ kind: "config", path: DEFAULT_CONFIG_PATH });
      } catch {
        setStep({ id: "menu" });
      }
    })();
  }, [onSubmit]);

  if (step.id === "checking") {
    return (
      <Box>
        <Text color="gray">Checking configuration...</Text>
      </Box>
    );
  }

  if (step.id === "menu") {
    return (
      <ModeSelector
        canCreate={!!configFlow}
        onChoose={(mode) =>
          setStep(mode === "open" ? { id: "form" } : mode === "exit" ? (onExit(), { id: "menu" }) : { id: "wizard" })
        }
      />
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
