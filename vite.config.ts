/**
 * @file Vite build configuration
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: "src",
      outDir: "dist",
      include: ["src"],
      exclude: ["**/*.spec.*", "spec", "tests", "debug", "node_modules", "dist"],
      tsconfigPath: "tsconfig.json",
      // Generate d.ts alongside built entries
      rollupTypes: false,
    }),
  ],
  build: {
    outDir: "dist",
    lib: {
      entry: {
        index: "src/index.ts",
        "client/index": "src/client/index.ts",
        "cli/index": "src/cli/main.tsx",
        "storage/node": "src/storage/node.ts",
        "storage/memory": "src/storage/memory.ts",
        "storage/opfs": "src/storage/opfs.ts",
        "storage/local_storage": "src/storage/local_storage.ts",
        "storage/session_storage": "src/storage/session_storage.ts",
        "storage/indexeddb": "src/storage/indexeddb.ts",
        "storage/types": "src/storage/types.ts",
      },
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: ["ink", "react", "react-dom", /node:.+/],
    },
  },
});
