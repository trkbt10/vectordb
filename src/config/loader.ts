/**
 * @file Config module loader (CJS/ESM/TS)
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { resolveConfigPath, CONFIG_EXTS, DEFAULT_CONFIG_STEM } from "./resolve";

/** Load a config module and return its default export (or module itself). */
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
