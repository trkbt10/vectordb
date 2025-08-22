/**
 * @file POST /vectors/find handler
 * Single result search (k=1 shorthand). Optional filter expression.
 */
import type { Context } from "hono";
import type { RouteContext } from "../context";
import type { FilterExpr } from "../../../attr/filter/expr";
import { normalizeVector, toNumberArray } from "../../utils";

type SearchBody = { vector: number[]; expr?: unknown };

/** Handle POST /vectors/find. */
export async function find(c: Context, { client }: RouteContext) {
  const body = await c.req.json<SearchBody>();
  const vec = toNumberArray(body?.vector);
  const expr = body?.expr as FilterExpr | undefined;
  if (!vec) {
    return c.json({ error: { message: "vector:number[] required" } }, 400);
  }
  const hit = await client.find(normalizeVector(vec), { expr });
  return c.json({ hit });
}
