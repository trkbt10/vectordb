/**
 * @file Vitest testing framework configuration
 *
 * This configuration sets up the Vitest test runner for the VectorLite
 * project, providing a fast and efficient testing environment. It configures:
 * - Global test utilities availability
 * - Node.js test environment for file system operations
 * - Test discovery and execution settings
 */

import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
  },
});
