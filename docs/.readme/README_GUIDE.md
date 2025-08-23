This folder holds README sections as Markdown files that get concatenated into the top-level README.md.

Conventions

- Prefix files with numbers to control order (e.g., `00-`, `10-`, `20-`).
- Use short, descriptive names (e.g., `10-features.md`).
- Keep each logical section in its own file.

Build

- Generate README: `npm run doc:compile`
- To exclude sections, add patterns to `.docignore` in this folder (supports `*` globs, one per line).
