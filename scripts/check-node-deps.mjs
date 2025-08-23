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
  const configPath = path.join(process.cwd(), 'build.entries.ts');
  // For now, we'll parse it manually since it's TypeScript
  // In production, you might want to use ts-node or compile it first
  const content = await fs.readFile(configPath, 'utf8');
  
  // Extract entries data using regex (simplified approach)
  const entriesMatch = content.match(/export const entries[^{]*{([\s\S]*?)^};/m);
  if (!entriesMatch) {
    throw new Error('Could not parse entries from build.entries.ts');
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
      const targets = targetsStr.match(/["']([\w]+)["']/g)?.map(t => t.replace(/["']/g, '')) || [];
      
      entries[name] = { targets };
    }
  });
  
  return entries;
}

// Node.js built-in modules and patterns to check
const NODE_MODULES = [
  "assert", "buffer", "child_process", "cluster", "console", "constants",
  "crypto", "dgram", "dns", "domain", "events", "fs", "http", "http2",
  "https", "inspector", "module", "net", "os", "path", "perf_hooks",
  "process", "punycode", "querystring", "readline", "repl", "stream",
  "string_decoder", "sys", "timers", "tls", "trace_events", "tty",
  "url", "util", "v8", "vm", "wasi", "worker_threads", "zlib"
];

// Patterns to detect Node.js dependencies
const NODE_PATTERNS = [
  // CommonJS requires
  ...NODE_MODULES.map(m => new RegExp(`require\\s*\\(\\s*["']${m}["']\\s*\\)`, 'g')),
  ...NODE_MODULES.map(m => new RegExp(`require\\s*\\(\\s*["']node:${m}["']\\s*\\)`, 'g')),
  
  // ES module imports
  ...NODE_MODULES.map(m => new RegExp(`from\\s+["']${m}["']`, 'g')),
  ...NODE_MODULES.map(m => new RegExp(`from\\s+["']node:${m}["']`, 'g')),
  ...NODE_MODULES.map(m => new RegExp(`import\\s+.*["']${m}["']`, 'g')),
  ...NODE_MODULES.map(m => new RegExp(`import\\s+.*["']node:${m}["']`, 'g')),
  
  // Dynamic imports
  ...NODE_MODULES.map(m => new RegExp(`import\\s*\\(\\s*["']${m}["']\\s*\\)`, 'g')),
  ...NODE_MODULES.map(m => new RegExp(`import\\s*\\(\\s*["']node:${m}["']\\s*\\)`, 'g')),
  
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

// Build patterns from entry catalog
async function buildPatternsFromEntries() {
  const entries = await loadBuildEntries();
  const nodeFreePatterns = [];
  const nodeAllowedPatterns = [];
  
  for (const [name, config] of Object.entries(entries)) {
    const basePath = name.replace(/\/index$/, '');
    
    if (config.targets.includes('browser') && !config.targets.includes('node')) {
      // Browser-only entries should be Node-free
      nodeFreePatterns.push(`**/${basePath}/**/*.js`);
      nodeFreePatterns.push(`**/${basePath}/**/*.mjs`);
      nodeFreePatterns.push(`**/${basePath}/**/*.cjs`);
      // Also check the entry file itself
      nodeFreePatterns.push(`**/${basePath}.js`);
      nodeFreePatterns.push(`**/${basePath}.mjs`);
      nodeFreePatterns.push(`**/${basePath}.cjs`);
    } else if (config.targets.includes('node') && !config.targets.includes('browser')) {
      // Node-only entries are allowed to have Node dependencies
      nodeAllowedPatterns.push(`**/${basePath}/**/*`);
      nodeAllowedPatterns.push(`**/${basePath}.*`);
    }
    // Universal entries are not strictly checked
  }
  
  // Always allow .cjs files to have Node dependencies
  nodeAllowedPatterns.push("**/*.cjs");
  
  return { nodeFreePatterns, nodeAllowedPatterns };
}

async function globMatch(filePath, patterns) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const pattern of patterns) {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');
    
    if (new RegExp(`^${regexPattern}$`).test(normalizedPath)) {
      return true;
    }
  }
  
  return false;
}

async function checkFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const violations = [];
  
  for (const pattern of NODE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push(...matches.map(match => ({
        match,
        line: content.substring(0, content.indexOf(match)).split('\n').length
      })));
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

async function main() {
  const distDir = path.join(process.cwd(), 'dist');
  
  try {
    await fs.access(distDir);
  } catch {
    console.error('Error: dist directory not found. Run build first.');
    process.exit(1);
  }
  
  // Load patterns from entry catalog
  const { nodeFreePatterns, nodeAllowedPatterns } = await buildPatternsFromEntries();
  
  console.log('📋 Checking Node.js dependencies based on build.entries.ts...\n');
  
  let hasViolations = false;
  const results = [];
  
  for await (const filePath of walkDir(distDir)) {
    const relativePath = path.relative(distDir, filePath);
    
    // Skip if file is allowed to have Node dependencies
    if (await globMatch(relativePath, nodeAllowedPatterns)) {
      continue;
    }
    
    // Check if file should be Node-free
    if (await globMatch(relativePath, nodeFreePatterns)) {
      const violations = await checkFile(filePath);
      
      if (violations.length > 0) {
        hasViolations = true;
        results.push({
          file: relativePath,
          violations
        });
      }
    }
  }
  
  if (hasViolations) {
    console.error('❌ Node.js dependencies found in browser-compatible files:\n');
    
    for (const result of results) {
      console.error(`📄 ${result.file}:`);
      for (const violation of result.violations) {
        console.error(`   Line ${violation.line}: ${violation.match}`);
      }
      console.error('');
    }
    
    console.error('These files should not contain Node.js-specific code.');
    console.error('Consider using environment-specific builds or runtime checks.\n');
    process.exit(1);
  } else {
    console.log('✅ No Node.js dependencies found in browser-compatible files.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});