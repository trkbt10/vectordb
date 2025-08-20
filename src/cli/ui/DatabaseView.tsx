/**
 * @file Database view: open filesystem-backed database and perform actions
 */
import React, { useEffect, useState } from "react";
import path from "node:path";
import { createNodeFileIO } from "../../storage/node";
import { connect } from "../../index";
import { ClusterForm } from "./database/ClusterForm";
import { LoadingScreen } from "./database/LoadingScreen";
import { ErrorScreen } from "./database/ErrorScreen";
import { ClusterMenu } from "./database/ClusterMenu";
import type { Step } from "./database/types";

/**
 * DatabaseView
 * Why: single entry to open a filesystem-backed database and route to DB tools.
 */
export function DatabaseView({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<Step>({ id: "form", indexRoot: ".vectordb", dataRoot: ".vectordb/data" });

  useEffect(() => {
    if (step.id !== "loading") return;
    const { indexRoot, dataRoot } = step;
    (async () => {
      try {
        const client = await connect<Record<string, unknown>>({
          storage: {
            index: createNodeFileIO(indexRoot),
            data: (key: string) => createNodeFileIO(path.join(dataRoot, key)),
          },
          database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
          index: { name: "db", shards: 1, segmented: true, segmentBytes: 1 << 16, includeAnn: false },
        });
        setStep({ id: "ready", ctx: { name: "db", client } });
      } catch (e) {
        const m = (e as { message?: unknown })?.message;
        setStep({ id: "error", msg: String(m ?? e) });
      }
    })();
  }, [step]);

  if (step.id === "form") {
    return (
      <ClusterForm
        onSubmit={(indexRoot, dataRoot) => setStep({ id: "loading", indexRoot, dataRoot })}
        onExit={onExit}
      />
    );
  }

  if (step.id === "loading") {
    return <LoadingScreen message="Opening database..." />;
  }

  if (step.id === "error") {
    return <ErrorScreen message={step.msg} onBack={onExit} />;
  }

  return <ClusterMenu ctx={step.ctx} onExit={onExit} />;
}
