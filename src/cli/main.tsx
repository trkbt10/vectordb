/**
 * @file VectorDB CLI entry (Ink + React)
 */
import React from "react";
import { render } from "ink";
import { App } from "./ui/App";
import path from "node:path";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { startServerFromFile } from "../http-server";

// Minimal arg parsing for --config or -c (no let)
const argv = process.argv.slice(2);
const configPath: string | undefined = (() => {
  const idx = argv.findIndex((a) => a === "--config" || a === "-c");
  if (idx < 0) {
    return undefined;
  }
  const v = argv[idx + 1];
  if (!v) {
    console.error("Missing value for --config");
    process.exit(1);
  }
  const p = path.resolve(v);
  if (!existsSync(p)) {
    console.error(`Config not found: ${p}`);
    process.exit(1);
  }
  return p;
})();

const shouldServe = argv.includes("--serve") || argv.includes("serve");
const portIdx = argv.findIndex((a) => a === "--port" || a === "-p");
const portVal = portIdx >= 0 ? Number(argv[portIdx + 1]) : undefined;

async function main() {
  const cfgPath = configPath ?? path.resolve("vectordb.config.json");
  if (!shouldServe) {
    render(<App initialConfigPath={configPath} />);
    return;
  }
  // Serve mode
  if (portVal === undefined) {
    await startServerFromFile(cfgPath);
    return;
  }
  // Shallow override by reading, changing, then starting
  const raw = await fs.readFile(cfgPath, "utf8");
  const json = JSON.parse(raw);
  json.server = { ...(json.server ?? {}), port: portVal };
  const tmp = path.join(process.cwd(), ".tmp", `server.${Date.now()}.json`);
  await fs.mkdir(path.dirname(tmp), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(json, null, 2), "utf8");
  await startServerFromFile(tmp);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
