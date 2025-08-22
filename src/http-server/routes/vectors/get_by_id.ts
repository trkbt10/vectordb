/**
 * @file GET /vectors/:id handler
 * Returns a single vector record by id, or 404 if absent.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { ensureNumericId } from "../../common/params";

/**
 * Handle GET /vectors/:id.
 * @param c - Hono context
 * @param client - Route context
 */
export async function getById(c: Context, { client }: RouteContext) {
  const id = ensureNumericId(c, "id");
  const rec = client.get(id);
  if (!rec) {
    return c.json({ error: { message: "Not found" } }, 404);
  }
  return c.json({ id, vector: Array.from(rec.vector), meta: rec.meta });
}
