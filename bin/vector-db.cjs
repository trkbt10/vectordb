#!/usr/bin/env node
/* eslint-disable -- CLI launcher is intentionally minimal */
/**
 * @file CLI launcher for VectorDB
 * Why: provide a stable executable that boots the built CLI bundle.
 */
try {
  require("../dist/cli/index.cjs");
} catch (e) {
  console.error("Failed to start CLI. Have you built the package? Run `npm run build`.");
  const msg = e && typeof e === "object" && "message" in e ? e.message : e;
  console.error(String(msg));
  process.exit(1);
}
