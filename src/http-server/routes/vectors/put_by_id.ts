/**
 * @file PUT /vectors/:id handler
 * Single upsert endpoint for a specific id.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { ensureNumericId } from "../../common/params";
import { toNumberArray, normalizeVector } from "../../utils";

/**
 *
 */
/**
 * Handle PUT /vectors/:id (single upsert).
 */
export async function putById(c: Context, { client, lock, wal, afterWrite }: RouteContext) {
  const id = ensureNumericId(c, "id");
  const body = await c.req.json<{ vector: number[]; meta?: Record<string, unknown> | null }>();
  const vec = toNumberArray(body?.vector);
  const meta = (body?.meta ?? null) as Record<string, unknown> | null;
  if (!vec) {
    return c.json({ error: { message: "vector:number[] required" } }, 400);
  }
  await lock.runExclusive(async () => {
    const vector = normalizeVector(vec);
    await wal.append([{ type: "upsert", id, vector, meta }]);
    client.set(id, { vector, meta }, { upsert: true });
    await afterWrite(1);
  });
  return c.json({ ok: true });
}
