/**
 * @file POST /vectors handler
 * Insert-only endpoint for vectors. Accepts either a single row `{ id, vector, meta? }`
 * or bulk `{ rows: [...] }`. Existing ids are rejected (single) or skipped (bulk).
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { parseBulkBody, parseVectorBody, normalizeVector, toNumberArray } from "../../utils";
import { httpError } from "../../common/errors";

/**
 * Handle POST /vectors (insert-only). Uses WAL before applying changes.
 * @param c - Hono context
 * @param ctx - Route context with client, WAL, lock
 */
export async function postCreate(c: Context, { client }: RouteContext) {
  const body = await c.req.json<unknown>();
  const bulk = parseBulkBody(body);
  if (bulk) {
    return bulkInsert(c, { client }, bulk.rows);
  }
  const single = parseVectorBody(body);
  if (!single) {
    return c.json({ error: { message: "id:number and vector:number[] required" } }, 400);
  }
  const id = single.id;
  const vec = single.vector;
  const meta = single.meta ?? null;
  if (await client.has(id)) {
    throw httpError(409, "Conflict: id already exists (insert-only)");
  }
  const vector = normalizeVector(vec);
  await client.push({ id, vector, meta });
  return c.json({ ok: true }, 201);
}

/**
 * Handle bulk insert-only payload.
 * @param c - Hono context
 * @param client - client in route context
 * @param lock - lock in route context (write exclusivity)
 * @param wal - wal runtime in route context
 * @param afterWrite - autosave hook
 * @param rows - validated insert rows
 */
async function bulkInsert(
  c: Context,
  { client }: RouteContext,
  rows: { id: number; vector: number[]; meta?: Record<string, unknown> | null }[],
) {
  if (rows.length === 0) {
    return c.json({ error: { message: "rows[] required" } }, 400);
  }
  const prepared: { id: number; vector: Float32Array; meta: Record<string, unknown> | null }[] = [];
  const createdIds: number[] = [];
  const skippedIds: number[] = [];
  for (const r of rows) {
    const id = Number(r?.id);
    const vec = toNumberArray(r?.vector);
    if (!Number.isFinite(id) || !vec) {
      continue;
    }
    if (await client.has(id)) {
      skippedIds.push(id);
      continue;
    }
    const vector = normalizeVector(vec);
    const meta = r?.meta ?? null;
    prepared.push({ id, vector, meta });
    createdIds.push(id);
  }
  if (prepared.length > 0) {
    await client.push(...prepared);
  }
  return c.json({ ok: true, created: createdIds.length, createdIds, skippedIds });
}
