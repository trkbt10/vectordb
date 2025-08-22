/**
 * @file Common request param helpers
 */
import type { Context } from "hono";
import { httpError } from "./errors";

/**
 *
 */
export function ensureNumericId(c: Context, name: string = "id"): number {
  const raw = c.req.param(name);
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw httpError(400, "Invalid id");
  }
  return id;
}
