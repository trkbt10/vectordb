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
import { createMemoryLock } from "../coordination/lock";
import { systemClock } from "../coordination/clock";
import { readHead, writeHead } from "../indexing/head_io";
import { tryUpdateHead } from "../coordination/head";
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
  const clock = cfg.server?.clock ?? systemClock;
  const epsilonMs = Math.max(0, cfg.server?.epsilonMs ?? 0);
  const lockProvider = cfg.server?.lock ?? createMemoryLock(clock);
  const lockName = cfg.server?.lockName ?? (cfg.name ?? "db");
  const lockTtlMs = Math.max(1, cfg.server?.lockTtlMs ?? 30000);

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
    const base = cfg.name ?? "db";
    if (!cfg.storage) {
      return c.json({ ok: false, error: { message: "storage_not_configured" } }, 500);
    }
    const resolveIndexIO = () => cfg.storage!.index;
    // Acquire shared lock (single-writer) with TTL
    const acq = lockProvider.acquire(lockName, lockTtlMs, "server");
    if (!acq.ok) {
      return c.json({ ok: false, error: { message: "lock_unavailable" } }, 409);
    }
    try {
      // Read current HEAD for epoch/lastCommittedTs
      const current = await readHead(base, { resolveIndexIO });
      const lastCommittedTs = current?.commitTs ?? 0;
      const epoch = current?.epoch ?? 0;
      // Save with coordination parameters (excess property on variable avoids excess-prop check)
      const args: { baseName: string } & { [k: string]: unknown } = { baseName: base };
      (args as { coord?: { clock?: typeof clock; epsilonMs?: number; lastCommittedTs?: number; epoch?: number } }).coord = {
        clock,
        epsilonMs,
        lastCommittedTs,
        epoch,
      };
      await wrapped.index.saveState(wrapped.state, args as { baseName: string });
      // CAS update of HEAD using manifest metadata
      try {
        const mbytes = await resolveIndexIO().read(`${base}.manifest.json`);
        const m = JSON.parse(new TextDecoder().decode(mbytes)) as { epoch?: number; commitTs?: number };
        const next = { manifest: `${base}.manifest.json`, epoch: m.epoch ?? epoch, commitTs: m.commitTs ?? lastCommittedTs };
        const cur2 = await readHead(base, { resolveIndexIO });
        const cas = tryUpdateHead(cur2, next);
        if (cas.ok) {
          await writeHead(base, cas.head, { resolveIndexIO });
        }
      } catch {
        // best-effort; ignore
      }
      return c.json({ ok: true });
    } finally {
      lockProvider.release(lockName, acq.epoch, "server");
    }
  });

  if (cfg.server?.embeddings) {
    mountEmbeddingsRoutes(app, cfg.server);
  }

  return app;
}
