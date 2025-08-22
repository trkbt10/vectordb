/**
 * @file PUT /vectors handler
 * Bulk upsert endpoint. Always writes WAL before applying the change.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { parseBulkBody, normalizeVector, toNumberArray } from "../../utils";

/**
 *
 */
/**
 * Handle PUT /vectors (bulk upsert).
 */
export async function putBulk(c: Context, { client }: RouteContext) {
  const body = await c.req.json<unknown>();
  const bulk = parseBulkBody(body);
  if (!bulk) {
    return c.json({ error: { message: "rows[] required" } }, 400);
  }
  const rows = bulk.rows;
  const prepared: { id: number; vector: Float32Array; meta: Record<string, unknown> | null }[] = [];
  const createdIds: number[] = [];
  const updatedIds: number[] = [];
  for (const r of rows) {
    const id = Number(r?.id);
    const vec = toNumberArray(r?.vector);
    if (!Number.isFinite(id) || !vec) {
      return c.json({ error: { message: "Each row requires id:number and vector:number[]" } }, 400);
    }
    const vector = normalizeVector(vec);
    const meta = r?.meta ?? null;
    prepared.push({ id, vector, meta });
    (await client.has(id) ? updatedIds : createdIds).push(id);
  }
  const count = await client.upsert(...prepared);
  return c.json({ ok: true, count, created: createdIds.length, updated: updatedIds.length, createdIds, updatedIds });
}
