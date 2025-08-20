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
        client: "src/client/index.ts",
        cli: "src/cli/main.tsx",
        "storage/node": "src/storage/node.ts",
        "storage/memory": "src/storage/memory.ts",
        "storage/opfs": "src/storage/opfs.ts",
        "storage/s3": "src/storage/s3.ts",
        "storage/types": "src/storage/types.ts",
      },
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: ["ink", "react", "react-dom", /node:.+/],
    },
  },
});
