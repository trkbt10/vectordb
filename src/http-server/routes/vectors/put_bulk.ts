/**
 * @file PUT /vectors handler
 * Bulk upsert endpoint. Always writes WAL before applying the change.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { parseBulkBody, normalizeVector, toNumberArray } from "../../utils";
import type { WalRecord } from "../../../wal";

/**
 *
 */
/**
 * Handle PUT /vectors (bulk upsert).
 */
export async function putBulk(c: Context, { client, lock, wal, afterWrite }: RouteContext) {
  const body = await c.req.json<unknown>();
  const bulk = parseBulkBody(body);
  if (!bulk) {
    return c.json({ error: { message: "rows[] required" } }, 400);
  }
  const rows = bulk.rows;
  const prepared: { id: number; vector: Float32Array; meta: Record<string, unknown> | null }[] = [];
  const walRecs: WalRecord[] = [];
  const createdIds: number[] = [];
  const updatedIds: number[] = [];
  for (const r of rows) {
    const id = Number(r?.id);
    const vec = toNumberArray(r?.vector);
    if (!Number.isFinite(id) || !vec) {
      return c.json({ error: { message: "Each row requires id:number and vector:number[]" } }, 400);
    }
    const vector = normalizeVector(vec);
    const meta = (r?.meta ?? null) as Record<string, unknown> | null;
    prepared.push({ id, vector, meta });
    walRecs.push({ type: "upsert", id, vector, meta });
    (client.has(id) ? updatedIds : createdIds).push(id);
  }
  const count = await lock.runExclusive(async () => {
    await wal.append(walRecs);
    const n = client.upsert(...prepared);
    await afterWrite(prepared.length);
    return n;
  });
  return c.json({ ok: true, count, created: createdIds.length, updated: updatedIds.length, createdIds, updatedIds });
}
