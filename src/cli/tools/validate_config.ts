/**
 * @file CLI tool: validate vectordb.config* structure (via loader + normalization)
 */
import { loadConfigModule, normalizeConfig, DEFAULT_CONFIG_STEM } from "../../config";

async function main() {
  const args = process.argv.slice(2);
  const file = args[0] ?? DEFAULT_CONFIG_STEM;
  try {
    const raw = await loadConfigModule(file);
    await normalizeConfig(raw);
    console.log(`Config OK: ${file}`);
    process.exit(0);
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : String(e);
    console.error(`Invalid config at ${file}:\n- ${msg}`);
    process.exit(1);
  }
}

main();
