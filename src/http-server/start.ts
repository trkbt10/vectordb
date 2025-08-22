/**
 * @file Server boot from a config file
 */
import { serve } from "@hono/node-server";
import { createClientFromConfig } from "./client";
import { normalizeConfig } from "./config";
import type { FileIO } from "../storage/types";
import { createApp } from "./app";
import type { AppConfig } from "./types";
import fs from "node:fs/promises";
import path from "node:path";

/**
 *
 */
export type StartServerOptions = { io?: Record<string, { indexFactory?: (url: URL) => FileIO; dataFactory?: (url: URL, ns: string) => FileIO }> };

/** Start the Hono server from a JSON config file path. */
export async function startServerFromFile(configPath = "vectordb.config.json", opts?: StartServerOptions) {
  const p = path.resolve(configPath);
  const raw = await fs.readFile(p, "utf8");
  const rawCfg = JSON.parse(raw) as unknown;
  const cfg: AppConfig = await normalizeConfig(rawCfg, { io: opts?.io, baseDir: path.dirname(p) });
  const client = await createClientFromConfig(cfg);
  const app = createApp(client, cfg);
  const port = cfg.server?.port ?? 8787;
  const host = cfg.server?.host ?? "0.0.0.0";
  serve({ fetch: app.fetch, port, hostname: host });
  console.log(`VectorDB server listening on http://${host}:${port}`);
  return { app, port, host };
}
