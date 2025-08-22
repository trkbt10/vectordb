/**
 * @file PATCH /vectors/:id/meta handler
 * Updates the meta payload for an existing id (WAL + exclusive write).
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { ensureNumericId } from "../../common/params";

/**
 *
 */
/**
 * Handle PATCH /vectors/:id/meta.
 */
export async function patchMeta(c: Context, { client }: RouteContext) {
  const id = ensureNumericId(c, "id");
  const body = await c.req.json<{ meta: Record<string, unknown> | null }>();
  const meta = body?.meta ?? null;
  const ok = await client.setMeta(id, meta);
  return c.json({ ok });
}
