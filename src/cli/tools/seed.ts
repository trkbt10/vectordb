/**
 * @file Simple data seeder using current vectordb.config.json
 *
 * Usage:
 *   bun run src/cli/tools/seed.ts               # uses ./vectordb.config.json
 *   bun run src/cli/tools/seed.ts -- --config ./path/to/vectordb.config.json --count 50
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { openFromConfig } from "../ui/features/database-viewer/components/open_from_config";
import { readFile } from "node:fs/promises";

function parseArgs() {
  const args = process.argv.slice(2);
  type Acc = { configPath?: string; count: number };
  const walk = (i: number, acc: Acc): Acc => {
    if (i >= args.length) return acc;
    const a = args[i];
    if (a === "--config" || a === "-c") {
      const v = args[i + 1];
      if (!v) throw new Error("Missing value for --config");
      return walk(i + 2, { ...acc, configPath: path.resolve(v) });
    }
    if (a === "--count" || a === "-n") {
      const v = Number(args[i + 1]);
      if (!Number.isFinite(v) || v <= 0) throw new Error("--count must be a positive number");
      return walk(i + 2, { ...acc, count: v | 0 });
    }
    return walk(i + 1, acc);
  };
  const parsed = walk(0, { count: 500 });
  const configPath = parsed.configPath ?? path.resolve("vectordb.config.json");
  return { configPath, count: parsed.count };
}

async function getBaseName(configPath: string): Promise<string> {
  const raw = await readFile(configPath, "utf8");
  const cfg = JSON.parse(raw) as { index?: { name?: string } };
  const name = cfg.index?.name;
  if (!name) throw new Error("Config must include index.name; refusing to guess");
  return name;
}

async function main() {
  const { configPath, count } = parseArgs();
  if (!existsSync(configPath)) throw new Error(`Config not found: ${configPath}`);
  const client = await openFromConfig(configPath);
  // Resolve baseName (index name) from config to persist changes
  const baseName = await getBaseName(configPath);
  const dim = client.state.dim;
  // Simple seed: spread across unit axes
  const rows = count;
  for (let i = 0; i < rows; i++) {
    const id = client.state.store._count + 1 + i;
    const vec = new Float32Array(dim);
    // Distribute items across dimensions to better cover space
    const axis = i % dim;
    for (let d = 0; d < dim; d++) vec[d] = d === axis ? 1 : 0;
    // Generate metadata with stable uniqueness and light grouping
    const meta = {
      key: `item-${id}`, // unique identifier string to avoid collisions
      idx: i,
      group: `g${axis}`, // group by axis for simple segmentation
      bucket: `b${(i % Math.min(rows, 64)).toString(36)}`,
    } as const;
    client.set(id, { vector: vec, meta }, { upsert: true });
  }
  // Persist state so subsequent opens can see the data
  await client.index.saveState(client.state, { baseName: baseName! });
  // Print summary
  const total = client.state.store._count;
  console.log(`Seeded ${rows} rows into ${path.basename(configPath)} • total now: ${total}`);
}

main().catch((e) => {
  console.error(String((e as { message?: unknown })?.message ?? e));
  process.exit(1);
});
