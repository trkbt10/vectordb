#!/usr/bin/env node
/* eslint-env node */
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const isCheckMode = process.argv.includes("--check");

const root = process.cwd();
const srcDir = path.join(root, "docs", ".readme");
const outFile = path.join(root, "README.md");

async function main() {
  try {
    // Load package.json for template variables
    const packageJsonContent = await fs.readFile(path.join(root, "package.json"), "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    // Get git origin URL
    let gitOrigin = "";
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"]);
      gitOrigin = stdout.trim();
      // Convert SSH URLs to HTTPS for better compatibility
      if (gitOrigin.startsWith("git@github.com:")) {
        gitOrigin = gitOrigin.replace("git@github.com:", "https://github.com/").replace(".git", "");
      }
    } catch (err) {
      // Git origin not available
    }

    // Template variables
    const templateVars = {
      NAME: packageJson.name,
      VERSION: packageJson.version,
      DESCRIPTION: packageJson.description || "",
      AUTHOR: packageJson.author || "",
      LICENSE: packageJson.license || "",
      HOMEPAGE: packageJson.homepage || "",
      REPOSITORY: packageJson.repository?.url || packageJson.repository || "",
      GIT_ORIGIN: gitOrigin,
    };

    // Function to replace template strings
    function replaceTemplates(content) {
      return content.replace(/\{\{([A-Z_]+)\}\}/g, (match, varName) => {
        return templateVars[varName] !== undefined ? templateVars[varName] : match;
      });
    }

    // Check if source directory exists
    try {
      await fs.access(srcDir);
    } catch (err) {
      console.error(`Missing directory: ${srcDir}`);
      process.exit(1);
    }

    // Load optional .docignore patterns
    const ignorePath = path.join(srcDir, ".docignore");
    let ignorePatterns = [];
    try {
      const ignoreContent = await fs.readFile(ignorePath, "utf8");
      ignorePatterns = ignoreContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    } catch (err) {
      // .docignore not found, use empty patterns
    }

    const ignoreRegexes = ignorePatterns.map((p) => {
      // convert simple glob "*" to regex, escape others
      const esc = p.replace(/[.+?^${}()|\[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${esc}$`, "i");
    });

    const dirEntries = await fs.readdir(srcDir);
    const files = dirEntries
      // only numbered markdown files like 00-..., 10-...
      .filter((f) => /^[0-9].*\.md$/i.test(f))
      // apply .docignore filters
      .filter((f) => !ignoreRegexes.some((rx) => rx.test(f)))
      .sort((a, b) => a.localeCompare(b, "en"));

    if (files.length === 0) {
      console.error(`No .md files found in ${srcDir}`);
      process.exit(1);
    }

    const parts = await Promise.all(
      files.map(async (f) => {
        const content = await fs.readFile(path.join(srcDir, f), "utf8");
        return replaceTemplates(content.trim()) + "\n";
      }),
    );
    const combined = parts.join("\n");

    if (isCheckMode) {
      // Check mode: verify if README.md is up to date
      try {
        const existing = await fs.readFile(outFile, "utf8");
        if (existing !== combined) {
          console.error(`ERROR: ${outFile} is out of date. Run 'npm run doc:compile' to update it.`);
          process.exit(1);
        }
        console.log("README.md is up to date.");
      } catch (err) {
        console.error(`ERROR: ${outFile} does not exist. Run 'npm run doc:compile' to generate it.`);
        process.exit(1);
      }
    } else {
      // Normal mode: write the file
      await fs.writeFile(outFile, combined, "utf8");
      console.log(`README generated from ${files.length} files.`);
      files.forEach((f) => console.log(` - ${f}`));
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Run the main function
main();
