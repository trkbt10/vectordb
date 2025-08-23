#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'docs', '.readme');
const outFile = path.join(root, 'README.md');

try {
  if (!fs.existsSync(srcDir)) {
    console.error(`Missing directory: ${srcDir}`);
    process.exit(1);
  }

  // Load optional .docignore patterns
  const ignorePath = path.join(srcDir, '.docignore');
  const ignorePatterns = fs.existsSync(ignorePath)
    ? fs
        .readFileSync(ignorePath, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];

  const ignoreRegexes = ignorePatterns.map((p) => {
    // convert simple glob "*" to regex, escape others
    const esc = p.replace(/[.+?^${}()|\[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${esc}$`, 'i');
  });

  const files = fs
    .readdirSync(srcDir)
    // only numbered markdown files like 00-..., 10-...
    .filter((f) => /^[0-9].*\.md$/i.test(f))
    // apply .docignore filters
    .filter((f) => !ignoreRegexes.some((rx) => rx.test(f)))
    .sort((a, b) => a.localeCompare(b, 'en'));

  if (files.length === 0) {
    console.error(`No .md files found in ${srcDir}`);
    process.exit(1);
  }

  const parts = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8').trim() + '\n');
  const combined = parts.join('\n');

  fs.writeFileSync(outFile, combined, 'utf8');

  console.log(`README generated from ${files.length} files.`);
  files.forEach((f) => console.log(` - ${f}`));
} catch (err) {
  console.error(err);
  process.exit(1);
}
