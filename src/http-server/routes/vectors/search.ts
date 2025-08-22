/**
 * @file POST /vectors/search handler
 * KNN search endpoint with optional filter expression and k.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import type { FilterExpr } from "../../../attr/filter/expr";
import { normalizeVector, toNumberArray } from "../../utils";

type SearchBody = { vector: number[]; k?: number; expr?: unknown };

/** Handle POST /vectors/search. */
export async function search(c: Context, { client }: RouteContext) {
  const body = await c.req.json<SearchBody>();
  const vec = toNumberArray(body?.vector);
  const k = Number(body?.k ?? 5);
  const expr = ((): FilterExpr | undefined => {
    const v = body?.expr;
    return v && typeof v === "object" ? (v as FilterExpr) : undefined;
  })();
  if (!vec) {
    return c.json({ error: { message: "vector:number[] required" } }, 400);
  }
  const hits = await client.findMany(normalizeVector(vec), { k: Number.isFinite(k) ? Math.max(1, k) : 5, expr });
  return c.json({ hits });
}
