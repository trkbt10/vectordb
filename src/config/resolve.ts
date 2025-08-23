/**
 * @file Config resolution + module loading
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createRequire } from "node:module";

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

/** Load a config module (CJS/ESM/TS) and return its default export (or module). */
export async function loadConfigModule(configPath?: string): Promise<unknown> {
  const resolved = (await resolveConfigPath(configPath)) ?? undefined;
  if (!resolved) {
    const stem = DEFAULT_CONFIG_STEM;
    throw new Error(
      `Config not found. Looked for ${configPath ?? stem + ".*"} with extensions ${CONFIG_EXTS.join(", ")}`,
    );
  }
  const ext = path.extname(resolved).toLowerCase();
  if (ext === ".cjs") {
    const req = createRequire(import.meta.url);
    const mod = req(resolved);
    return (mod && (mod.default ?? mod)) as unknown;
  }
  const url = pathToFileURL(resolved).href;
  try {
    // eslint-disable-next-line no-restricted-syntax -- dynamic import is required to load user config modules
    const mod = await import(url);
    return (mod && (mod.default ?? mod)) as unknown;
  } catch (e) {
    if (ext === ".ts" || ext === ".mts") {
      throw new Error(
        `Failed to load TypeScript config '${path.basename(resolved)}'. ` +
          `Use a TS loader (e.g., ts-node/register) or pre-compile to .mjs/.js. Original: ${String(
            (e as { message?: unknown })?.message ?? e,
          )}`,
      );
    }
    throw e;
  }
}
