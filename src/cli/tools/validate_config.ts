/**
 * @file CLI tool: validate vectordb.config.json structure
 */
import { validateConfigFile } from "../../http-server/config_validate";

async function main() {
  const args = process.argv.slice(2);
  const file = args[0] ?? "vectordb.config.json";
  const res = await validateConfigFile(file);
  if (res.ok) {
        console.log(`Config OK: ${res.path}`);
    process.exit(0);
  }
    console.error(`Invalid config at ${res.path}:\n- ${res.errors.join("\n- ")}`);
  process.exit(1);
}

main();

