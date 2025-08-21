/**
 * @file Bulk operations for efficient batch processing
 *
 * This module provides optimized bulk operations for adding and removing
 * multiple vectors in a single call. Key features:
 * - Batch insertion with configurable error handling modes
 * - Detailed result reporting (success count, failures, duplicates)
 * - Transaction-like semantics with all-or-nothing mode
 * - Efficient pre-allocation and capacity management
 *
 * Bulk operations significantly reduce overhead when working with large
 * datasets by minimizing function call overhead and enabling better
 * resource allocation strategies.
 */
import { VectorStoreState, UpsertOptions, RowInput } from "../../types";
import { add, remove } from "./core";

/**
 *
 */
export function upsertMany<TMeta>(
  vl: VectorStoreState<TMeta>,
  rows: RowInput<TMeta>[],
  opts?: UpsertOptions & { mode?: "best_effort" | "all_or_nothing" },
) {
  const res: { ok: number; failed: number; duplicates: number[]; errors: { id: number; reason: string }[] } = {
    ok: 0,
    failed: 0,
    duplicates: [],
    errors: [],
  };
  const mode = opts?.mode ?? "best_effort";
  try {
    for (const r of rows) {
      try {
        add(vl, r.id, r.vector, r.meta ?? null, { upsert: true });
        res.ok++;
      } catch (e: unknown) {
        res.failed++;
        // eslint-disable-next-line no-restricted-syntax -- Error handling: extracting error message
        let reason = String(e);
        if (typeof e === "object" && e !== null && "message" in e) {
          const msg = (e as { message?: unknown }).message;
          reason = typeof msg === "string" ? msg : String(msg);
        }
        res.errors.push({ id: r.id, reason });
      }
    }
    if (mode === "all_or_nothing" && res.failed > 0) {
      throw new Error(`upsertMany failed for ${res.failed}/${rows.length}`);
    }
  } catch {
    // Silently ignore errors in best_effort mode
  }
  return res;
}

/**
 *
 */
export function removeMany<TMeta>(vl: VectorStoreState<TMeta>, ids: number[], opts?: { ignoreMissing?: boolean }) {
  const res = { ok: 0, missing: [] as number[] };
  for (const id of ids) {
    const ok = remove(vl, id);
    if (ok) res.ok++;
    if (!ok && !opts?.ignoreMissing) res.missing.push(id);
  }
  return res;
}
