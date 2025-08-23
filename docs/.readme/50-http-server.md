## HTTP Server (Hono)

- REST server using `hono` + `@hono/node-server`。
- CLI の `--serve` で起動し、`vectordb.config.*` で設定します。

### Start

```bash
# Build outputs (includes http-server)
npm run build

# Start via CLI (uses vectordb.config.json)
npx {{NAME}} --serve --config ./vectordb.config.json

# Or directly run the built server bundle
npm run serve
```

### Config: server options

Author a JS ESM config (executable) with a `server` block:

```js
// vectordb.config.* (mjs, js, cjs, mts, cts, ts)
import { defineConfig } from "{{NAME}}/http-server";

export default defineConfig({
  name: "db",
  storage: {
    index: "file:.vectordb/index", // index artifacts
    data: "file:.vectordb/data", // data segments (can be URI or key→URI map)
  },
  database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
  index: { name: "db", segmented: true },
  server: {
    port: 8787,
    cors: true,
    // Enable time-based result consistency (bounded-staleness read via HEAD); default: true
    resultConsistency: true,
    embeddings: {
      provider: "openai",
      model: "text-embedding-3-small",
      openAICompatRoute: true,
    },
  },
});
```

#### Result consistency (bounded staleness)

- `server.resultConsistency` (default `true`)
  - `true`: readers prefer `.head.json` when its `commitTs` is readable at `clock.now() - epsilonMs`.
  - `false`: readers ignore `.head.json` and open the default manifest `${name}.manifest.json` directly.
- Related knobs (optional): `server.clock`, `server.epsilonMs`.

Invalid configs print errors to stderr. Check server startup logs when troubleshooting.

Storage URIs are scheme-based:

- Built‑in: `file:` (Node FS), `mem:` (in‑memory)
- Others (e.g., s3, gs, r2, dynamodb) can be provided by the server when starting (driver registry).
- `storage.data` supports either a single URI or a key→URI map per CRUSH target. Templates with `{ns}` are supported, for example: `"data": "s3://bucket/prefix/{ns}"`.

WAL: The server binds WAL to the index storage as `<name>.wal` (no separate config required).

Notes:

- `server.cors`: `true` to allow all, or an object matching Hono's CORS options.
- `server.embeddings.provider: "openai"` exposes POST `/embeddings` and `/v1/embeddings` (OpenAI-compatible). API key is read from `OPENAI_API_KEY` or `server.embeddings.apiKey`.
- Optional `--port` or `-p` CLI flag overrides `server.port` when using `--serve`.
- Config formats supported by loader: mjs, js, cjs, mts, cts, ts (discovery order). JSON is not supported.

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
