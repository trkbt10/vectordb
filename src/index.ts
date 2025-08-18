/**
 * VectorLite public entry point (minimal).
 *
 * Purpose: Expose only initialization and core types so applications import
 * operational APIs explicitly via subpaths. This keeps the entry side-effect
 * free and environment-agnostic, aiding tree-shaking.
 */

export type { VectorLiteState } from "./vectorlite/state";
export type { VectorLiteOptions, HNSWParams, Metric } from "./types";

export { createVectorLite } from "./vectorlite/create";
export { deserializeVectorLite } from "./vectorlite/serialize";
