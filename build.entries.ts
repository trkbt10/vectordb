/**
 * @file Build entry catalog - Defines all entry points and their target environments
 *
 * This file serves as the single source of truth for:
 * 1. Vite build configuration (entry points and externals)
 * 2. Node.js dependency checking (which files should be browser-compatible)
 *
 * Target types:
 * - "node": Can only run in Node.js environment
 * - "browser": Can only run in browser environment
 * - "universal": Can run in both environments
 *
 * Usage:
 * - Add new entries to the `entries` object below
 * - Specify appropriate targets for each entry
 * - Node.js dependency checker will automatically validate browser-only entries
 * - Vite will build all entries with proper externals
 *
 * Adding a new entry:
 * ```typescript
 * "my-module/index": {
 *   path: "src/my-module/index.ts",
 *   targets: ["browser"],  // or ["node"], ["universal"]
 *   description: "My module description",
 *   external: ["some-dep"], // optional external dependencies
 * }
 * ```
 */

export type BuildTarget = "node" | "browser" | "universal";

export type EntryConfig = {
  /**
   * Entry file path relative to project root
   */
  path: string;
  /**
   * Target environments where this entry can run
   */
  targets: BuildTarget[];
  /**
   * Optional description of the entry
   */
  description?: string;
  /**
   * External dependencies for this entry (passed to Rollup)
   */
  external?: string[];
};

export type EntryCatalog = {
  [entryName: string]: EntryConfig;
};

/**
 * Catalog of all build entries with their target environments
 */
export const entries: EntryCatalog = {
  // Main entry - universal
  index: {
    path: "src/index.ts",
    targets: ["universal"],
    description: "Main library entry point",
  },

  // Client
  "client/index": {
    path: "src/client/index.ts",
    targets: ["universal"],
    description: "Client implementation",
  },

  // CLI - Node.js only
  "cli/index": {
    path: "src/cli/main.tsx",
    targets: ["node"],
    description: "Command line interface",
    external: ["ink", "react", "react-dom"],
  },

  // HTTP Server - Node.js only
  "http-server/index": {
    path: "src/http-server/index.ts",
    targets: ["node"],
    description: "HTTP server implementation",
    external: ["hono", "@hono/node-server"],
  },

  // Storage implementations
  "storage/node": {
    path: "src/storage/node.ts",
    targets: ["node"],
    description: "Node.js file system storage",
  },

  "storage/memory": {
    path: "src/storage/memory.ts",
    targets: ["universal"],
    description: "In-memory storage (works everywhere)",
  },

  "storage/opfs": {
    path: "src/storage/opfs.ts",
    targets: ["browser"],
    description: "Origin Private File System storage",
  },

  "storage/local_storage": {
    path: "src/storage/local_storage.ts",
    targets: ["browser"],
    description: "Browser localStorage adapter",
  },

  "storage/session_storage": {
    path: "src/storage/session_storage.ts",
    targets: ["browser"],
    description: "Browser sessionStorage adapter",
  },

  "storage/indexeddb": {
    path: "src/storage/indexeddb.ts",
    targets: ["browser"],
    description: "Browser IndexedDB storage",
  },

  // Additional storage helpers
  "storage/cache": {
    path: "src/storage/cache.ts",
    targets: ["browser"],
    description: "Cache API-based storage (Service Worker)",
  },

  "storage/guards": {
    path: "src/storage/guards.ts",
    targets: ["universal"],
    description: "Runtime guards for FileIO",
  },

  "storage/types": {
    path: "src/storage/types.ts",
    targets: ["universal"],
    description: "Storage type definitions",
  },

  // Config public surface
  "config/index": {
    path: "src/config/index.ts",
    targets: ["node"],
    description: "Config API surface and helpers",
  },

  // Presets (use-case specific)
  "presets/config/browser-inmemory": {
    path: "src/presets/config/browser-inmemory.ts",
    targets: ["browser"],
    description: "Config preset: in-memory via mem: URIs",
  },
  "presets/config/browser-localstorage": {
    path: "src/presets/config/browser-localstorage.ts",
    targets: ["browser"],
    description: "Config preset: browser localStorage",
  },
  "presets/config/node-fs": {
    path: "src/presets/config/node-fs.ts",
    targets: ["node"],
    description: "Config preset: Node.js filesystem",
  },
  "presets/config/node-inmemory": {
    path: "src/presets/config/node-inmemory.ts",
    targets: ["node"],
    description: "Config preset: Node.js in-memory",
  },
};

/**
 * Get all entries that should work in a specific target environment
 */
export function getEntriesForTarget(target: BuildTarget): string[] {
  return Object.entries(entries)
    .filter(([, config]) => config.targets.includes(target) || config.targets.includes("universal"))
    .map(([name]) => name);
}

/**
 * Get all external dependencies for all entries
 */
export function getAllExternals(): Array<string | RegExp> {
  const externals = new Set<string | RegExp>();

  // Add Node.js built-ins
  externals.add(/node:.+/);

  // Add entry-specific externals
  for (const config of Object.values(entries)) {
    if (config.external) {
      config.external.forEach((ext) => externals.add(ext));
    }
  }

  return Array.from(externals);
}

/**
 * Convert entries to Vite lib entry format
 */
export function getViteEntries(): Record<string, string> {
  const viteEntries: Record<string, string> = {};

  for (const [name, config] of Object.entries(entries)) {
    viteEntries[name] = config.path;
  }

  return viteEntries;
}
