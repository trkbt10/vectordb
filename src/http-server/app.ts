/**
 * @file Hono app assembly
 */
import { Hono } from "hono";
import type { Context } from "hono";
import type { AppConfig } from "./types";
import { applyCors } from "./cors";
import { mountEmbeddingsRoutes } from "./embeddings";
import { redactConfig } from "./utils";
import type { VectorDB } from "../client";
import type { RouteContext } from "./routes/context";
/* no direct type import to avoid unused warnings; use inline import() */
import { getById } from "./routes/vectors/get_by_id";
import { deleteById } from "./routes/vectors/delete_by_id";
import { postCreate } from "./routes/vectors/post_create";
import { putBulk } from "./routes/vectors/put_bulk";
import { putById } from "./routes/vectors/put_by_id";
import { patchMeta } from "./routes/vectors/patch_meta";
import { patchVector } from "./routes/vectors/patch_vector";
import { search as searchVectors } from "./routes/vectors/search";
import { find as findVector } from "./routes/vectors/find";

/**
 *
 */
/** Build and return a Hono app exposing REST endpoints over the database. */
export function createApp(client: VectorDB<Record<string, unknown>>, cfg: AppConfig) {
  const app = new Hono();
  const wrapped = client;

  app.onError((err: Error & { status?: number }) => {
    const message = err.message ?? String(err);
    const status = (err as { status?: number }).status ?? 500;
    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  app.notFound((c) => c.json({ error: { message: "Not Found" } }, 404));

  applyCors(app, cfg.server?.cors);

  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/stats", (c) =>
    c.json({
      size: wrapped.size,
      dim: wrapped.state.dim,
      metric: wrapped.state.metric,
      strategy: wrapped.state.strategy,
    }),
  );
  app.get("/config", (c) => c.json(redactConfig(cfg)));

  // Existence checkは GET /vectors/:id で 200/404 を利用

  const ctx: RouteContext = { client: wrapped };
  app.get("/vectors/:id", (c) => getById(c, ctx));

  app.delete("/vectors/:id", (c) => deleteById(c, ctx));

  // local type kept for clarity in this file only

  // POST /vectors (insert-only; single or bulk)
  app.post("/vectors", (c) => postCreate(c, ctx));

  // PUT /vectors – bulk upsert
  app.put("/vectors", (c) => putBulk(c, ctx));

  // PUT /vectors/:id – single upsert
  app.put("/vectors/:id", (c) => putById(c, ctx));

  // setMeta
  app.patch("/vectors/:id/meta", (c) => patchMeta(c, ctx));

  // setVector (preserves meta)
  app.patch("/vectors/:id/vector", (c) => patchVector(c, ctx));

  // findMany
  app.post("/vectors/search", (c) => searchVectors(c, ctx));

  // find single
  app.post("/vectors/find", (c) => findVector(c, ctx));

  app.post("/save", async (c: Context) => {
    await wrapped.index.saveState(wrapped.state, { baseName: cfg.name ?? "db" });
    return c.json({ ok: true });
  });

  if (cfg.server?.embeddings) {
    mountEmbeddingsRoutes(app, cfg.server);
  }

  return app;
}
