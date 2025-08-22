/**
 * @file Route handler context shared across modules
 */
import type { VectorDB } from "../../client";

export type RouteContext = { client: VectorDB<Record<string, unknown>> };
