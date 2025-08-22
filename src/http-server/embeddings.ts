/**
 * @file Embeddings route (OpenAI-compatible)
 */
import type { Hono } from "hono";
import type { ServerOptions } from "./types";
import type { Context } from "hono";

/** Mount OpenAI-compatible embeddings endpoints if configured. */
export function mountEmbeddingsRoutes(app: Hono, server: ServerOptions | undefined) {
  if (!server || !server.embeddings) {
    throw new Error(
      "Embeddings route requested but 'server.embeddings' is not configured. Remove the call or provide embeddings configuration.",
    );
  }
  const emb = server.embeddings;
  if (emb.provider !== "openai") {
    throw new Error(
      `Unsupported embeddings provider: ${String((emb as { provider?: unknown }).provider)}. Only 'openai' is supported.`,
    );
  }
  const getKey = () => emb.apiKey ?? process.env[emb.apiKeyEnv ?? "OPENAI_API_KEY"] ?? "";
  const baseURL = emb.baseURL ?? "https://api.openai.com/v1";
  const model = emb.model ?? "text-embedding-3-small";

  const handler = async (c: Context) => {
    const body = await c.req.json<{ input: unknown; model?: string }>();
    const input = body?.input;
    const mdl = body?.model ?? model;
    const key = getKey();
    if (!key) {
      return c.json({ error: { message: "Missing OpenAI API key" } }, 400);
    }
    const res = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ input, model: mdl }),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  };

  app.post("/embeddings", handler);
  if (emb.openAICompatRoute !== false) {
    app.post("/v1/embeddings", handler);
  }
}
