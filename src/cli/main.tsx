/**
 * @file VectorDB CLI entry (Ink + React)
 */
import React from "react";
import { render } from "ink";
import { App } from "./ui/App";
import path from "node:path";
import { existsSync } from "node:fs";

// Minimal arg parsing for --config or -c (no let)
const argv = process.argv.slice(2);
const configPath: string | undefined = (() => {
  const idx = argv.findIndex((a) => a === "--config" || a === "-c");
  if (idx < 0) return undefined;
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

render(<App initialConfigPath={configPath} />);
