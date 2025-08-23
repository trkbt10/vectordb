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
  if (await exists(base)) {
    return base;
  }
  if (path.extname(base)) {
    return null;
  }
  for (const ext of CONFIG_EXTS) {
    const cand = `${base}${ext}`;
    if (await exists(cand)) {
      return cand;
    }
  }
  try {
    const statPath = path.join(base, DEFAULT_CONFIG_STEM);
    for (const ext of CONFIG_EXTS) {
      const cand = `${statPath}${ext}`;
      if (await exists(cand)) {
        return cand;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Module loading is implemented in './loader.ts' to keep responsibilities separate.
