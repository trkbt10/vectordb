/**
 * @file PATCH /vectors/:id/vector handler
 * Updates the vector for an id while preserving meta.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import { ensureNumericId } from "../../common/params";
import { toNumberArray, normalizeVector } from "../../utils";

/** Handle PATCH /vectors/:id/vector. */
export async function patchVector(c: Context, { client, lock, wal, afterWrite }: RouteContext) {
  const id = ensureNumericId(c, "id");
  const body = await c.req.json<{ vector: number[] }>();
  const vec = toNumberArray(body?.vector);
  if (!vec) {
    return c.json({ error: { message: "vector:number[] required" } }, 400);
  }
  await lock.runExclusive(async () => {
    const prev = client.get(id);
    const meta = prev?.meta ?? null;
    const vector = normalizeVector(vec);
    await wal.append([{ type: "upsert", id, vector, meta }]);
    client.setVector(id, vector, { upsert: true });
    await afterWrite(1);
  });
  return c.json({ ok: true });
}
