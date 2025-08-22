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
export async function patchMeta(c: Context, { client, lock, wal, afterWrite }: RouteContext) {
  const id = ensureNumericId(c, "id");
  const body = await c.req.json<{ meta: Record<string, unknown> | null }>();
  const meta = (body?.meta ?? null) as Record<string, unknown> | null;
  await lock.runExclusive(async () => {
    await wal.append([{ type: "setMeta", id, meta }]);
    client.setMeta(id, meta);
    await afterWrite(1);
  });
  return c.json({ ok: true });
}
