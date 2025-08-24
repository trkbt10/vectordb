/**
 * @file VectorDB CLI entry (Ink + React)
 */
import React from "react";
import { render } from "ink";
import { App } from "./ui/App";
import path from "node:path";
import { existsSync } from "node:fs";
import { resolveConfigPath, DEFAULT_CONFIG_STEM } from "../config";
import { startServerFromFile } from "../http-server";

// Minimal arg parsing for --config or -c (no let)
const argv = process.argv.slice(2);
const wantsHelp = argv.includes("--help") || argv.includes("-h") || argv[0] === "help";
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
  // Keep the raw path here; main() will validate/resolve to a supported executable config
  return p;
})();

const shouldServe = argv.includes("--serve") || argv.includes("serve");
const portIdx = argv.findIndex((a) => a === "--port" || a === "-p");
const portVal = portIdx >= 0 ? Number(argv[portIdx + 1]) : undefined;
const hostIdx = argv.findIndex((a) => a === "--host" || a === "-H");
const hostVal = hostIdx >= 0 ? String(argv[hostIdx + 1]) : undefined;

async function main() {
  if (wantsHelp) {
    console.log(
      `\nUsage: vcdb [command] [options]\n\nCommands:\n  serve                 Start HTTP server using config (required)\n\nOptions:\n  --config, -c <path>   Path to executable config (vectordb.config.*)\n  --port, -p <number>   Override server.port from config\n  --host, -H <host>     Override server.host from config\n  --help, -h            Show this help\n\nExamples:\n  vcdb                   # Launch interactive UI\n  vcdb serve             # Start server using vectordb.config.*\n  vcdb serve -c ./vectordb.config.mjs\n  vcdb serve -p 8787 -H 0.0.0.0\n`,
    );
    return;
  }
  // If a config was explicitly provided, validate and normalize it to a supported file first
  const cfgPath: string | undefined = await (async () => {
    if (!configPath) {
      return undefined;
    }
    const resolved = await resolveConfigPath(configPath);
    if (!resolved) {
      console.error(`Config not found. Looked for ${configPath} with extensions .mjs, .js, .cjs, .mts, .cts, .ts`);
      process.exit(1);
    }
    return resolved;
  })();
  const defaultPath = path.resolve(DEFAULT_CONFIG_STEM);
  const effectivePath = cfgPath ?? defaultPath;
  if (!shouldServe) {
    render(<App initialConfigPath={cfgPath} />);
    return;
  }
  // Serve mode: prefer config; override with CLI flags if provided.
  await startServerFromFile(effectivePath, { port: portVal, host: hostVal });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
