import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    lib: {
      entry: "src/index.tsx",
      fileName: "index",
      formats: ["cjs", "es"],
    },
    rollupOptions: {
      external: ["ink", "react"],
    },
  },
});
