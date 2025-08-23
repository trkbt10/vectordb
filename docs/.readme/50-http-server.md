## HTTP Server (Hono)

- REST server using `hono` + `@hono/node-server`。
- CLI の `serve` で起動し、`vectordb.config.*`（実行可能な JS/TS）で設定します。

### Start

```bash
# Start via CLI (uses vectordb.config.*)
vcdb serve

# With an explicit config path
vcdb serve --config ./vectordb.config.mjs

# Override port/host (CLI flags take precedence over config)
vcdb serve -p 8787 -H 0.0.0.0
```

### Config: server options

Author an executable config with a `server` block (mjs, mts, ts, js, cjs supported; JSON is not supported):

```js
// vectordb.config.* (mjs, mts, ts, js, cjs)
import { defineConfig } from "{{NAME}}/config";

export default defineConfig({
  name: "db",
  storage: {
    index: "file:.vectordb/index", // index artifacts
    data: "file:.vectordb/data", // data segments (can be URI or key→URI map)
  },
  database: { dim: 3, metric: "cosine", strategy: "bruteforce" },
  index: { name: "db", segmented: true },
  server: {
    host: "0.0.0.0",
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
- CLI flags `--port/-p` と `--host/-H` は config の値より優先されます。
- Config formats supported by loader: mjs, mts, ts, js, cjs（JSON は未対応）。

### REST endpoints

- `GET /health` → `{ ok: true }`
- `GET /stats` → `{ size, dim, metric, strategy }`
- `GET /config` → server config (secrets redacted)
- `GET /vectors/:id` → `{ id, vector, meta }`
- `DELETE /vectors/:id` → `{ ok }`
- `POST /vectors` → Insert-only. Single `{ id, vector:number[], meta? }` or bulk `{ rows:[{ id, vector, meta? }] }`
- `PUT /vectors` → Bulk upsert. Body `{ rows:[{ id, vector, meta? }] }`
- `PUT /vectors/:id` → Single upsert. Body `{ vector:number[], meta? }`
- `POST /vectors/search` → Body `{ vector:number[], k?, expr? }` returns `{ hits }`
- `POST /vectors/find` → Body `{ vector:number[], expr? }` returns `{ hit }`
- `POST /save` → Persist current state via index ops (single-writer enforced)
- Embeddings (if enabled):
  - `POST /embeddings` or `/v1/embeddings` → forwards to OpenAI embeddings with configured model/key
