/**
 * @file Vite build configuration
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    lib: {
      entry: {
        index: "src/index.ts",
        db: "src/db.ts",
        cluster: "src/cluster.ts",
      },
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: ["ink", "react", /node:.+/],
    },
  },
});
