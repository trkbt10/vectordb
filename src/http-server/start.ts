/**
 * @file Server boot from a config file
 */
import path from "node:path";
import { serve } from "@hono/node-server";
import { createClientFromConfig } from "./client";
import { DEFAULT_CONFIG_STEM } from "../config";
import { loadConfigModule, normalizeConfig } from "../config";
import { createApp } from "./app";
import type { AppConfig } from "./types";

/** Start the Hono server from an executable config module path. */
export async function startServerFromFile(configPath: string = DEFAULT_CONFIG_STEM) {
  const p = path.resolve(configPath);
  const rawCfg = await loadConfigModule(p);
  const cfg: AppConfig = await normalizeConfig(rawCfg);
  const client = await createClientFromConfig(cfg);
  const app = createApp(client, cfg);
  const port = cfg.server?.port ?? 8787;
  const host = cfg.server?.host ?? "0.0.0.0";
  serve({ fetch: app.fetch, port, hostname: host });
  console.log(`VectorDB server listening on http://${host}:${port}`);
  return { app, port, host };
}
