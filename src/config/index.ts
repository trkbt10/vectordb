/**
 * @file Shared config API surface for CLI and server.
 */
import path from "node:path";
import { createClientFromConfig } from "../http-server/client";
import type { VectorDB } from "../client";
import { CONFIG_EXTS, DEFAULT_CONFIG_STEM } from "./resolve";
import { loadConfigModule } from "./loader";
import { normalizeConfig } from "./normalize";
export { createNodeFileIO } from "../storage/node";
export { createMemoryFileIO } from "../storage/memory";

export { resolveConfigPath, CONFIG_EXTS, DEFAULT_CONFIG_STEM } from "./resolve";
export { loadConfigModule } from "./loader";
export { normalizeConfig, defineConfig, type RawAppConfig } from "./normalize";
export type { AppConfig, ServerOptions, CorsOptions } from "./types";

/** Load + normalize + open a VectorDB client from a config path. */
export async function openClientFromConfig(pathToConfig: string): Promise<VectorDB<Record<string, unknown>>> {
  const p = path.resolve(pathToConfig);
  const raw = await loadConfigModule(p);
  const cfg = await normalizeConfig(raw);
  return await createClientFromConfig(cfg);
}

/** A short label like `vectordb.config[mjs/mts/ts/cjs/js]` for UI/help. */
export function configPatternsLabel(): string {
  return `${DEFAULT_CONFIG_STEM}[${CONFIG_EXTS.map((e) => e.slice(1)).join("/")}]`;
}

/** Default stem path string like './vectordb.config' for prompts. */
export function defaultConfigPath(): string {
  return `./${DEFAULT_CONFIG_STEM}`;
}

// Discovery/load helpers for UI/CLI
export {
  type Resource,
  type DiscoveryState,
  type LoadState,
  createConfigDiscovery,
  getConfigDiscovery,
  defaultConfigResource,
  createConfigLoad,
  getConfigLoad,
} from "./discovery";
