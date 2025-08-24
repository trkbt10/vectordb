/**
 * @file Executable config example (TS)
 * Use URI-based storage to reduce coupling and keep config portable.
 */
import { defineConfig } from "./src/config";

export default defineConfig({
  name: "db",
  storage: {
    // Relative paths resolve to file: scheme
    index: ".vectordb/index",
    // Use {ns} template to namespace data shards by database name
    data: ".vectordb/data/{ns}",
  },
  database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
  // Index options (name uses top-level `name`)
  index: { segmented: true },
  server: { resultConsistency: true },
});
