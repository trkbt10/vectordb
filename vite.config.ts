/**
 * @file Vite build configuration
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { getViteEntries, getAllExternals } from "./build.entries";
import type { Plugin } from "vite";
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
  ] as Plugin[],
  build: {
    outDir: "dist",
    lib: {
      entry: getViteEntries(),
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: getAllExternals(),
    },
  },
});
