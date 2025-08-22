/**
 * @file DELETE /vectors/:id handler
 * Deletes a single vector by id. Uses WAL for durability and a mutex for
 * write exclusivity. Returns `{ ok: true, deleted: true }` on success.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { ensureNumericId } from "../../common/params";

/**
 * Handle DELETE /vectors/:id.
 * @param c - Hono context (provides path params and respond helpers)
 * @param client - Route context: database client, WAL, lock, etc
 */
export async function deleteById(c: Context, { client }: RouteContext) {
  const id = ensureNumericId(c, "id");
  const ok = await client.delete(id);
  return c.json({ ok, deleted: ok });
}
