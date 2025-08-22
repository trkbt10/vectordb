/**
 * @file Registry helpers: read database registry JSON
 */
import path from "node:path";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import type { DatabaseRegistry } from "../../../../../types/registry";
import type { DatabaseRegistryEntry } from "../../../../../types/registry";

/** Get default registry JSON path (project-local). */
export function defaultRegistryPath(): string {
  // Project-local by default; fall back to user home when not present
  return path.resolve(process.cwd(), ".vectordb/registry.json");
}

/** Read registry JSON; returns empty list when missing. */
export async function readRegistry(p?: string): Promise<DatabaseRegistry> {
  const file = p ? path.resolve(p) : defaultRegistryPath();
  try {
    const raw = await readFile(file, "utf8");
    const json = JSON.parse(raw) as unknown;
    const entries = Array.isArray((json as { entries?: unknown }).entries) ? (json as DatabaseRegistry).entries : [];
    return { entries };
  } catch {
    return { entries: [] };
  }
}

/** Write registry JSON atomically-ish (simple overwrite). */
export async function writeRegistry(reg: DatabaseRegistry, p?: string): Promise<void> {
  const file = p ? path.resolve(p) : defaultRegistryPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(reg, null, 2), "utf8");
}

/** Upsert one entry by configPath; returns updated registry. */
export async function upsertRegistryEntry(entry: { name: string; configPath: string; description?: string }, p?: string): Promise<DatabaseRegistry> {
  const file = p ? path.resolve(p) : defaultRegistryPath();
  const reg = await readRegistry(file);
  const ix = reg.entries.findIndex((e) => path.resolve(e.configPath) === path.resolve(entry.configPath));
  if (ix >= 0) reg.entries[ix] = { ...reg.entries[ix], ...entry };
  if (ix < 0) reg.entries.push(entry);
  await writeRegistry(reg, file);
  return reg;
}

/** Discover config files under typical locations; returns entries (not persisted). */
export async function discoverConfigs({ roots = ["." , "./configs"], maxDepth = 2 }: { roots?: string[]; maxDepth?: number } = {}): Promise<DatabaseRegistryEntry[]> {
  const out: DatabaseRegistryEntry[] = [];
  const seen = new Set<string>();
  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    // Normalize Dirent typing without using any
    try {
      const entsUnknown = await readdir(dir, { withFileTypes: true } as unknown as { withFileTypes: true });
      type DirLike = { name: string; isDirectory(): boolean; isFile(): boolean };
      const ents = entsUnknown as unknown as DirLike[];
      for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.startsWith(".")) continue;
        await walk(p, depth + 1);
        continue;
      }
      const lower = ent.name.toLowerCase();
      const isCandidate =
        ent.isFile() &&
        lower.endsWith(".json") &&
        (lower === "vectordb.config.json" || (lower.includes("vectordb") && lower.includes("config")));
      if (isCandidate) {
        const abs = path.resolve(p);
        if (seen.has(abs)) continue;
        seen.add(abs);
        const name = path.basename(ent.name).replace(/\.[^/.]+$/, "");
        out.push({ name, configPath: abs });
      }
      }
    } catch { return; }
  }
  for (const r of roots) await walk(path.resolve(r), 0);
  return out;
}
