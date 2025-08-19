/**
 * @file Vite build configuration for library bundling
 * 
 * This configuration sets up Vite to build VectorLite as a distributable
 * library with support for both CommonJS and ES modules. It handles:
 * - TypeScript compilation and bundling
 * - React plugin integration for development tools
 * - External dependency management
 * - Optimized production builds with minification
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    lib: {
      entry: "src/index.ts",
      fileName: "index",
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: ["ink", "react"],
    },
  },
});
