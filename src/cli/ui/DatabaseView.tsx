/**
 * @file Database view: open filesystem-backed database and perform actions
 */
import React, { useEffect, useState } from "react";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createNodeFileIO } from "../../storage/node";
import { connect } from "../../index";
import { DatabaseForm } from "./database/DatabaseForm";
import { LoadingScreen } from "./database/LoadingScreen";
import { ErrorScreen } from "./database/ErrorScreen";
import { ClusterMenu } from "./database/ClusterMenu";
import type { Step, OpenInput } from "./database/types";

/**
 * DatabaseView
 * Why: single entry to open a filesystem-backed database and route to DB tools.
 */
export function DatabaseView({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<Step>({ id: "form" });

  useEffect(() => {
    if (step.id !== "loading") return;
    const input = step.input;
    (async () => {
      try {
        const clientName = input.kind === "folder" ? (input.name || "db") : "db";
        const client = input.kind === "folder"
          ? await connect<Record<string, unknown>>({
            storage: {
              index: createNodeFileIO(input.indexRoot),
              data: (key: string) => createNodeFileIO(path.join(input.dataRoot, key)),
            },
            database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
            index: { name: clientName },
          })
          : await (async () => {
              const raw = await readFile(input.path, "utf8");
              type Cfg = {
                name?: string;
                indexRoot: string;
                dataRoot: string;
                database?: { dim: number; metric: "cosine" | "l2" | "dot"; strategy: "bruteforce" | "hnsw" | "ivf" } & Record<string, unknown>;
                index?: Record<string, unknown>;
              };
              const cfg: Cfg = JSON.parse(raw) as Cfg;
              if (!cfg.indexRoot) throw new Error("config.indexRoot is required");
              if (!cfg.dataRoot) throw new Error("config.dataRoot is required");
              const name = cfg.name || clientName;
              const storage = {
                index: createNodeFileIO(cfg.indexRoot),
                data: (key: string) => createNodeFileIO(path.join(cfg.dataRoot, key)),
              };
              const hasDb = !!cfg.database;
              return await connect<Record<string, unknown>>({
                storage,
                index: { name, ...(cfg.index ?? {}) },
                ...(hasDb
                  ? { database: cfg.database }
                  : { onMissing: async () => { throw new Error("State missing and no database options provided in config"); } }),
              });
            })();
        setStep({ id: "ready", ctx: { name: clientName, client } });
      } catch (e) {
        const m = (e as { message?: unknown })?.message;
        setStep({ id: "error", msg: String(m ?? e) });
      }
    })();
  }, [step]);

  if (step.id === "form") {
    return (
      <DatabaseForm onSubmit={(input: OpenInput) => setStep({ id: "loading", input })} onExit={onExit} />
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
