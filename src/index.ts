// Minimal entry: only DB initialization utilities.
/*
<purpose>
  Provide a minimal entry that exposes only DB initialization utilities
  so that applications opt into operational APIs explicitly via subpaths
  and benefit from maximal tree-shaking with no unintended side-effects.
  Exposed surface: createVectorLite, deserializeVectorLite + related types.
</purpose>

<constraints>
  <no-reexports>Do not re-export operational helpers (add/search/remove/serialize), WAL, or persistence backends from this entry.</no-reexports>
  <subpaths-only>Operational APIs must be imported from './vectorlite', './wal', or './persist/*'.</subpaths-only>
  <no-side-effects>This module must remain side-effect free (safe for ESM tree-shaking).</no-side-effects>
  <stable-surface>Initialization API should remain stable across minor versions.</stable-surface>
  <env-agnostic>No Node-only or browser-only code paths here; keep environment-agnostic.</env-agnostic>
</constraints>

<forbidden>
  <umbrella-exports>Adding umbrella exports that pull in non-initialization code.</umbrella-exports>
  <default-export>Introducing a default export.</default-export>
  <global-singleton>Embedding global singletons or implicit state.</global-singleton>
  <debug-hooks>Including debug/CLI/demo utilities in this entry.</debug-hooks>
</forbidden>
*/

export { createVectorLite, deserializeVectorLite } from "./vectorlite";
export type { VectorLiteState } from "./vectorlite";
export type { VectorLiteOptions, HNSWParams, Metric } from "./types";
