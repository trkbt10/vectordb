## HTTP Server (Hono)

- Built-in REST server using `hono` + `@hono/node-server`.
- Start from the CLI with `--serve` and configure via `vectordb.config.json`.
- Vite builds a dedicated server bundle at `dist/http-server/index.{js,cjs}`.

### Start

```bash
# Build outputs (includes http-server)
npm run build

# Start via CLI (uses vectordb.config.json)
npx vcdb --serve --config ./vectordb.config.json

# Or directly run the built server bundle
npm run serve
```

### Config: server options (vite-like)

Extend your `vectordb.config.json` with a `server` block:

```jsonc
{
  "name": "db",
  "storage": {
    "index": "file:.vectordb/index",        // index artifacts
    "data":  "file:.vectordb/data"          // data segments (can be URI or key→URI map)
  },
  "database": { "dim": 3, "metric": "cosine", "strategy": "bruteforce" },
  "index": { "name": "db", "segmented": true },
  "server": {
    "port": 8787,
    "cors": true,
    "embeddings": {
      "provider": "openai",
      "model": "text-embedding-3-small",
      "openAICompatRoute": true
    }
  }
}
```

Storage URIs are scheme-based:

- Built‑in: `file:` (Node FS), `mem:` (in‑memory)
- Others (e.g., s3, gs, r2, dynamodb) can be provided by the server when starting (driver registry).
- `storage.data` supports either a single URI or a key→URI map per CRUSH target. Templates with `{ns}` are supported, for example: `"data": "s3://bucket/prefix/{ns}"`.

WAL: The server binds WAL to the index storage as `<name>.wal` (no separate config required).

Notes:

- `server.cors`: `true` to allow all, or an object matching Hono's CORS options.
- `server.embeddings.provider: "openai"` exposes POST `/embeddings` and `/v1/embeddings` (OpenAI-compatible). API key is read from `OPENAI_API_KEY` or `server.embeddings.apiKey`.
- Optional `--port` or `-p` CLI flag overrides `server.port` when using `--serve`.

### REST endpoints

- `GET /health` → `{ ok: true }`
- `GET /stats` → `{ size, dim, metric, strategy }`
- `GET /config` → server config (secrets redacted)
- `GET /vectors/:id` → `{ id, vector, meta }`
- `DELETE /vectors/:id` → `{ ok }`
- `POST /vectors` → body `{ id, vector:number[], meta?, upsert? }`
- `POST /vectors/bulk` → body `{ rows:[{ id, vector, meta? }], upsert? }` returns `{ ok, count }`
- `POST /search` → body `{ vector:number[], k?, expr? }` returns `{ hits }`
- `POST /save` → persist current state via index ops
- Embeddings (if enabled):
  - `POST /embeddings` or `/v1/embeddings` → forwards to OpenAI embeddings with configured model/key

Error handling uses Hono's `onError` and `notFound` conventions (no try/catch in handlers).

