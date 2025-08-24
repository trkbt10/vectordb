#!/usr/bin/env node
/* eslint-env node */
/**
 * @file Node.js dependency checker - Validates browser compatibility of built files
 *
 * This script ensures that browser-targeted build outputs don't contain Node.js dependencies.
 * It uses build.entries.ts to determine which files should be Node-free based on their targets.
 *
 * Features:
 * - Detects Node.js module imports/requires (fs, path, crypto, etc.)
 * - Detects Node.js globals (process, __dirname, Buffer, etc.)
 * - Dynamically determines check targets from build.entries.ts
 * - Runs automatically after build via postbuild hook
 *
 * Usage:
 * - Automatic: Runs after npm run build
 * - Manual: npm run check:node-deps
 *
 * Target rules:
 * - "browser" only entries → Must be Node-free
 * - "node" only entries → Can have Node dependencies
 * - "universal" entries → Not strictly checked
 * - *.cjs files → Always allowed to have Node dependencies
 *
 * Configuration:
 * Edit build.entries.ts to change which entries are checked.
 * Entries marked as browser-only will be validated for Node.js dependencies.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Load the build entries configuration
async function loadBuildEntries() {
  const configPath = path.join(process.cwd(), "build.entries.ts");
  // For now, we'll parse it manually since it's TypeScript
  // In production, you might want to use ts-node or compile it first
  const content = await fs.readFile(configPath, "utf8");

  // Extract entries data using regex (simplified approach)
  const entriesMatch = content.match(/export const entries[^{]*{([\s\S]*?)^};/m);
  if (!entriesMatch) {
    throw new Error("Could not parse entries from build.entries.ts");
  }

  // This is a simplified parser - in production you'd want proper TS parsing
  const entriesStr = entriesMatch[1];
  const entries = {};

  // Parse each entry block
  const entryBlocks = entriesStr.split(/^\s*["']?[\w/-]+["']?\s*:\s*{/m).slice(1);
  const entryNames = entriesStr.match(/^\s*["']?([\w/-]+)["']?\s*:\s*{/gm) || [];

  entryNames.forEach((nameMatch, i) => {
    const name = nameMatch.match(/["']?([\w/-]+)["']?/)[1];
    const block = entryBlocks[i];

    // Extract targets array
    const targetsMatch = block.match(/targets:\s*\[(.*?)\]/s);
    if (targetsMatch) {
      const targetsStr = targetsMatch[1];
      const targets = targetsStr.match(/["']([\w]+)["']/g)?.map((t) => t.replace(/["']/g, "")) || [];

      entries[name] = { targets };
    }
  });

  return entries;
}

// Node.js built-in modules and patterns to check
const NODE_MODULES = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
];

// Patterns to detect Node.js dependencies
const NODE_PATTERNS = [
  // CommonJS requires
  ...NODE_MODULES.map((m) => new RegExp(`require\\s*\\(\\s*["']${m}["']\\s*\\)`, "g")),
  ...NODE_MODULES.map((m) => new RegExp(`require\\s*\\(\\s*["']node:${m}["']\\s*\\)`, "g")),

  // ES module imports
  ...NODE_MODULES.map((m) => new RegExp(`from\\s+["']${m}["']`, "g")),
  ...NODE_MODULES.map((m) => new RegExp(`from\\s+["']node:${m}["']`, "g")),
  ...NODE_MODULES.map((m) => new RegExp(`import\\s+.*["']${m}["']`, "g")),
  ...NODE_MODULES.map((m) => new RegExp(`import\\s+.*["']node:${m}["']`, "g")),

  // Dynamic imports
  ...NODE_MODULES.map((m) => new RegExp(`import\\s*\\(\\s*["']${m}["']\\s*\\)`, "g")),
  ...NODE_MODULES.map((m) => new RegExp(`import\\s*\\(\\s*["']node:${m}["']\\s*\\)`, "g")),

  // Global Node.js objects (more selective to avoid false positives)
  /\bprocess\.env\b/g,
  /\bprocess\.argv\b/g,
  /\bprocess\.exit\b/g,
  /\bprocess\.cwd\b/g,
  /\b__dirname\b/g,
  /\b__filename\b/g,
  /\bglobal\.process\b/g,
  /\bBuffer\.from\b/g,
  /\bBuffer\.alloc\b/g,
];

// Patterns to detect Browser-specific dependencies
const BROWSER_TOKENS = [
  { symbol: "window", re: /\bwindow\./g },
  { symbol: "document", re: /\bdocument\./g },
  { symbol: "navigator", re: /\bnavigator\./g },
  { symbol: "self", re: /\bself\./g },
  { symbol: "localStorage", re: /\blocalStorage\b/g },
  { symbol: "sessionStorage", re: /\bsessionStorage\b/g },
  { symbol: "indexedDB", re: /\bindexedDB\b/g },
  { symbol: "caches", re: /\bcaches\b/g },
  { symbol: "CacheStorage", re: /\bCacheStorage\b/g },
  { symbol: "showDirectoryPicker", re: /\bshowDirectoryPicker\b/g },
  { symbol: "FileSystemHandle", re: /\bFileSystem(?:Directory|File)Handle\b/g },
];

function isGuardedBrowserAccess(content, index, symbol) {
  const head = content.slice(0, index);
  const guards = [
    new RegExp(`typeof\\s+${symbol}\\s*!==?\\s*["']undefined["']`),
    new RegExp(`["']${symbol}["']\\s+in\\s+globalThis`),
  ];
  // window/document/navigator/self may be guarded via typeof window
  if (symbol === "navigator" || symbol === "window" || symbol === "document" || symbol === "self") {
    guards.push(/typeof\s+window\s*!==?\s*['"]undefined['"]/);
    guards.push(/["']window["']\s+in\s+globalThis/);
    guards.push(/typeof\s+globalThis\s*!==?\s*['"]undefined['"]/);
  }
  return guards.some((re) => re.test(head));
}

function collectBrowserViolations(content, strict = false) {
  const violations = [];
  for (const tok of BROWSER_TOKENS) {
    tok.re.lastIndex = 0;
    let m;
    while ((m = tok.re.exec(content)) != null) {
      const idx = m.index;
      if (!strict && isGuardedBrowserAccess(content, idx, tok.symbol)) {
        continue;
      }
      violations.push({ match: m[0], line: content.substring(0, idx).split("\n").length });
    }
  }
  return violations;
}

// Build patterns from entry catalog
async function buildPatternsFromEntries() {
  const entries = await loadBuildEntries();
  const nodeFreePatterns = []; // files that must NOT use Node deps (browser or universal)
  const nodeAllowedPatterns = []; // files where Node deps are allowed (node-only)
  const browserFreePatterns = []; // files that must NOT use Browser deps (node or universal)

  for (const [name, config] of Object.entries(entries)) {
    const basePath = name.replace(/\/index$/, "");
    const isBrowserOnly = config.targets.includes("browser") && !config.targets.includes("node");
    const isUniversal = config.targets.includes("universal");
    const isNodeOnly = config.targets.includes("node") && !config.targets.includes("browser");

    if (isBrowserOnly || isUniversal) {
      // Browser-only and universal entries should be Node-free
      nodeFreePatterns.push(`${basePath}/**/*.js`);
      nodeFreePatterns.push(`${basePath}/**/*.mjs`);
      // Entry file itself and hashed siblings
      nodeFreePatterns.push(`${basePath}.js`);
      nodeFreePatterns.push(`${basePath}-*.js`);
      nodeFreePatterns.push(`${basePath}.mjs`);
      nodeFreePatterns.push(`${basePath}-*.mjs`);
    }

    if (isNodeOnly || isUniversal) {
      // Node-only and universal entries should be Browser-free
      browserFreePatterns.push(`${basePath}/**/*.js`);
      browserFreePatterns.push(`${basePath}/**/*.mjs`);
      browserFreePatterns.push(`${basePath}/**/*.cjs`);
      browserFreePatterns.push(`${basePath}.js`);
      browserFreePatterns.push(`${basePath}-*.js`);
      browserFreePatterns.push(`${basePath}.mjs`);
      browserFreePatterns.push(`${basePath}-*.mjs`);
      browserFreePatterns.push(`${basePath}.cjs`);
      browserFreePatterns.push(`${basePath}-*.cjs`);
    }

    if (isNodeOnly) {
      // Node-only entries are allowed to have Node dependencies
      nodeAllowedPatterns.push(`${basePath}/**/*`);
      nodeAllowedPatterns.push(`${basePath}.*`);
      // Some node-only outputs may emit hashed siblings at the root
      nodeAllowedPatterns.push(`${basePath}-*.*`);
    }
  }

  // Always allow .cjs files to have Node dependencies
  nodeAllowedPatterns.push("**/*.cjs");

  return { nodeFreePatterns, nodeAllowedPatterns, browserFreePatterns };
}

function globToRegex(glob) {
  let out = "^";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*" && glob[i + 2] === "/") {
        // **/ -> zero or more directories
        out += "(?:[^/]*/)*";
        i += 3;
        continue;
      } else if (glob[i + 1] === "*") {
        // ** -> any chars
        out += ".*";
        i += 2;
        continue;
      } else {
        // * -> any segment chars except '/'
        out += "[^/]*";
        i += 1;
        continue;
      }
    } else if (c === "?") {
      out += ".";
      i += 1;
      continue;
    } else {
      if ("\\^$+?.()|{}[]".includes(c)) {
        out += "\\" + c;
      } else {
        out += c;
      }
      i += 1;
      continue;
    }
  }
  out += "$";
  return new RegExp(out);
}

async function globMatch(filePath, patterns) {
  const normalizedPath = filePath.replace(/\\\\/g, "/");
  for (const pattern of patterns) {
    const re = globToRegex(pattern);
    if (re.test(normalizedPath)) return true;
  }
  return false;
}

async function checkFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const violations = [];

  for (const pattern of NODE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push(
        ...matches.map((match) => ({
          match,
          line: content.substring(0, content.indexOf(match)).split("\n").length,
        })),
      );
    }
  }

  return violations;
}

async function* walkDir(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);

    if (file.isDirectory()) {
      yield* walkDir(filePath);
    } else if (file.isFile() && /\.(js|mjs|cjs)$/.test(file.name)) {
      yield filePath;
    }
  }
}

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const arg of argv.slice(2)) {
    if (arg === "--verbose" || arg === "-v") {
      flags.add("verbose");
    } else if (arg === "--json") {
      flags.add("json");
    } else if (arg.startsWith("--")) {
      const [k, v = true] = arg.replace(/^--/, "").split("=");
      opts[k] = v;
    }
  }
  return { flags, opts };
}

function mapFileToEntry(file, targetedEntries) {
  // Find the longest matching entry prefix for grouping
  let best = null;
  for (const name of targetedEntries) {
    if (file === `${name}.js` || file === `${name}.mjs` || file === `${name}.cjs` || file.startsWith(`${name}/`)) {
      if (best == null || name.length > best.length) {
        best = name;
      }
    }
  }
  return best || "(unmapped)";
}

async function main() {
  const distDir = path.join(process.cwd(), "dist");
  const { flags } = parseArgs(process.argv);

  try {
    await fs.access(distDir);
  } catch {
    console.error("Error: dist directory not found. Run build first.");
    process.exit(1);
  }

  // Load patterns from entry catalog
  const entries = await loadBuildEntries();
  const browserOnlyEntries = Object.entries(entries)
    .filter(([, c]) => c.targets.includes("browser") && !c.targets.includes("node"))
    .map(([name]) => name);
  const universalEntries = Object.entries(entries)
    .filter(([, c]) => c.targets.includes("universal"))
    .map(([name]) => name);
  const targetedEntries = [...browserOnlyEntries, ...universalEntries];
  const { nodeFreePatterns, nodeAllowedPatterns, browserFreePatterns } = await buildPatternsFromEntries();

  console.log("📋 Checking environment-specific dependencies based on build.entries.ts...\n");

  let hasViolations = false;
  const resultsNode = []; // Node deps found in browser/universal
  const resultsBrowser = []; // Browser deps found in node/universal
  const okFiles = []; // OK list for Node-deps check (verbose)
  const unmappedFiles = []; // files not matching allowed nor targeted patterns
  let allowed = 0; // files allowed by pattern (node-only or .cjs)
  let checkedNodeFree = 0;
  let checkedBrowserFree = 0;
  let totalJs = 0;

  for await (const filePath of walkDir(distDir)) {
    const relativePath = path.relative(distDir, filePath);

    totalJs++;
    const isAllowedNode = await globMatch(relativePath, nodeAllowedPatterns);
    const isBrowserTarget = await globMatch(relativePath, nodeFreePatterns);
    const isNodeTarget = await globMatch(relativePath, browserFreePatterns);

    // Node deps check for browser/universal
    if (!isAllowedNode && (isBrowserTarget || flags.has("strict"))) {
      checkedNodeFree++;
      const violations = await checkFile(filePath);
      if (violations.length > 0) {
        hasViolations = true;
        resultsNode.push({
          file: relativePath,
          entry: mapFileToEntry(relativePath.replace(/\\\\/g, "/"), targetedEntries),
          violations,
        });
      } else if (flags.has("verbose")) {
        okFiles.push({
          file: relativePath,
          entry: mapFileToEntry(relativePath.replace(/\\\\/g, "/"), targetedEntries),
        });
      }
    } else if (isAllowedNode) {
      allowed++;
    }

    // Browser deps check for node/universal
    if (isNodeTarget || flags.has("strict")) {
      checkedBrowserFree++;
      const content = await fs.readFile(filePath, "utf8");
      const browserViolations = collectBrowserViolations(content, /*strict*/ false);
      if (browserViolations.length > 0) {
        hasViolations = true;
        resultsBrowser.push({
          file: relativePath,
          entry: mapFileToEntry(relativePath.replace(/\\\\/g, "/"), targetedEntries),
          violations: browserViolations,
        });
      }
    }

    if (!isBrowserTarget && !isNodeTarget && !flags.has("strict")) {
      unmappedFiles.push(relativePath);
    }
  }

  if (hasViolations) {
    if (resultsNode.length > 0) {
      console.error("❌ Node deps found in browser/universal targets:\n");
      const byEntry = new Map();
      for (const r of resultsNode) {
        if (!byEntry.has(r.entry)) byEntry.set(r.entry, []);
        byEntry.get(r.entry).push(r);
      }
      for (const [entry, items] of byEntry) {
        console.error(`📦 Entry: ${entry}`);
        for (const result of items) {
          console.error(`  📄 ${result.file}`);
          for (const violation of result.violations) {
            console.error(`     • Line ${violation.line}: ${violation.match}`);
          }
        }
        console.error("");
      }
    }

    if (resultsBrowser.length > 0) {
      console.error("❌ Browser deps found in node/universal targets:\n");
      const byEntry = new Map();
      for (const r of resultsBrowser) {
        if (!byEntry.has(r.entry)) byEntry.set(r.entry, []);
        byEntry.get(r.entry).push(r);
      }
      for (const [entry, items] of byEntry) {
        console.error(`📦 Entry: ${entry}`);
        for (const result of items) {
          console.error(`  📄 ${result.file}`);
          for (const violation of result.violations) {
            console.error(`     • Line ${violation.line}: ${violation.match}`);
          }
        }
        console.error("");
      }
    }

    const showAllowed = flags.has("verbose") || flags.has("show-allowed");
    const showUnmapped = flags.has("verbose") || flags.has("list-unmapped");
    const parts = [
      `checked(browser/universal)=${checkedNodeFree}`,
      `checked(node/universal)=${checkedBrowserFree}`,
      `violations=${resultsNode.length + resultsBrowser.length}`,
    ];
    if (showAllowed) parts.push(`allowed=${allowed}`);
    if (showUnmapped) parts.push(`unmapped=${unmappedFiles.length}`);
    const summary = "Summary: " + parts.join(", ");
    if (showUnmapped && unmappedFiles.length > 0) {
      console.error("Unmapped (not targeted) files:");
      for (const f of unmappedFiles) console.error(` - ${f}`);
      console.error("");
    }
    console.error(summary);
    process.exit(1);
  } else {
    // Success
    console.log("✅ No environment-specific dependency violations found.");
    // Optional verbose listing
    if (flags.has("verbose")) {
      const byEntryOk = new Map();
      for (const r of okFiles) {
        if (!byEntryOk.has(r.entry)) byEntryOk.set(r.entry, []);
        byEntryOk.get(r.entry).push(r);
      }
      console.log("\n🔎 Enforced entries:");
      for (const name of targetedEntries) {
        const count = okFiles.filter((r) => r.entry === name).length;
        console.log(` - ${name}${count ? ` (ok files: ${count})` : ""}`);
      }
      if (okFiles.length > 0) {
        console.log("\n📋 Checked files (OK):");
        for (const [entry, files] of byEntryOk) {
          console.log(`📦 Entry: ${entry}`);
          for (const f of files) {
            console.log(`  ✅ ${f.file}`);
          }
        }
      }
    }
    // Always print a compact summary
    const showAllowed = flags.has("verbose") || flags.has("show-allowed");
    const showUnmapped = flags.has("verbose") || flags.has("list-unmapped");
    const parts = [
      `checked(browser/universal)=${checkedNodeFree}`,
      `checked(node/universal)=${checkedBrowserFree}`,
      `violations=${resultsNode.length + resultsBrowser.length}`,
    ];
    if (showAllowed) parts.push(`allowed=${allowed}`);
    if (showUnmapped) parts.push(`unmapped=${unmappedFiles.length}`);
    const summary = "Summary: " + parts.join(", ");
    console.log(`\n${summary}`);
    if (showUnmapped && unmappedFiles.length > 0) {
      console.log("Unmapped (not targeted) files:");
      for (const f of unmappedFiles) console.log(` - ${f}`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
