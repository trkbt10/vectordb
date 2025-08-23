/**
 * @file Config resolution (path discovery only)
 */
import path from "node:path";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

/** Supported executable config extensions (resolution order). */
export const CONFIG_EXTS = [".mjs", ".mts", ".ts", ".cjs", ".js"] as const;
/** Default, extensionless config file stem used across the project. */
export const DEFAULT_CONFIG_STEM = "vectordb.config" as const;

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a config path: allow directory, bare name, or explicit file. */
export async function resolveConfigPath(input?: string): Promise<string | null> {
  const base = input ? path.resolve(input) : path.resolve(DEFAULT_CONFIG_STEM);
  const ext = path.extname(base);
  if (ext) {
    return (await exists(base)) ? base : null;
  }
  for (const e of CONFIG_EXTS) {
    const cand = `${base}${e}`;
    if (await exists(cand)) {
      return cand;
    }
  }
  const nested = path.join(base, DEFAULT_CONFIG_STEM);
  for (const e of CONFIG_EXTS) {
    const cand = `${nested}${e}`;
    if (await exists(cand)) {
      return cand;
    }
  }
  return null;
}

// Module loading is implemented in './loader.ts' to keep responsibilities separate.
