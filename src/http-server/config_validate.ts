/**
 * @file JSON config validator (non-throwing)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { toURL } from "./io_resolver";
// Note: validates raw structure; does not depend on AppConfig types

type ValidationResult = { ok: true; errors: [] } | { ok: false; errors: string[] };

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== "object") {
    return false;
  }
  return Object.getPrototypeOf(x) === Object.prototype;
}

function nonEmptyString(x: unknown): x is string {
  if (typeof x !== "string") {
    return false;
  }
  return x.length > 0;
}

/** Validate a raw JSON-like config object; returns a list of errors instead of throwing. */
export function validateRawAppConfig(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ["config: must be a JSON object"] };
  }
  const cfg = raw as Record<string, unknown>;

  // name
  if (cfg.name !== undefined && !nonEmptyString(cfg.name)) {
    errors.push("name: must be a non-empty string if provided");
  }

  // storage
  const storage = cfg.storage as unknown;
  if (!isPlainObject(storage)) {
    errors.push("storage: required object with { index, data }");
  }
  if (isPlainObject(storage)) {
    const index = (storage as Record<string, unknown>).index;
    const data = (storage as Record<string, unknown>).data;
    if (!nonEmptyString(index)) {
      errors.push("storage.index: required string (URI or file path)");
    }
    if (nonEmptyString(index)) {
      try {
        toURL(index);
      } catch {
        errors.push("storage.index: invalid URI or path");
      }
    }
    if (typeof data === "string") {
      if (!nonEmptyString(data)) {
        errors.push("storage.data: must be non-empty string when provided as URI");
      }
      if (nonEmptyString(data)) {
        try {
          toURL(data);
        } catch {
          errors.push("storage.data: invalid URI or path");
        }
      }
    }
    if (typeof data !== "string") {
      if (isPlainObject(data)) {
        for (const [k, v] of Object.entries(data)) {
          if (!nonEmptyString(k)) {
            errors.push("storage.data: map keys must be non-empty strings");
            break;
          }
          if (!nonEmptyString(v)) {
            errors.push(`storage.data['${k}']: must be non-empty string URI`);
            continue;
          }
          try {
            toURL(v);
          } catch {
            errors.push(`storage.data['${k}']: invalid URI or path`);
          }
        }
      }
      if (!isPlainObject(data)) {
        errors.push("storage.data: required string or { [ns]: uri }");
      }
    }
  }

  // database (partial)
  const db = cfg.database as unknown;
  if (db !== undefined && !isPlainObject(db)) {
    errors.push("database: must be an object");
  }
  if (isPlainObject(db)) {
      const dim = (db as Record<string, unknown>).dim;
      const metric = (db as Record<string, unknown>).metric;
      const strategy = (db as Record<string, unknown>).strategy;
      if (!(typeof dim === "number" && Number.isFinite(dim) && dim > 0)) {
        errors.push("database.dim: required positive number");
      }
      if (!(metric === "cosine" || metric === "l2" || metric === "dot")) {
        errors.push("database.metric: must be 'cosine' | 'l2' | 'dot'");
      }
      if (!(strategy === "bruteforce" || strategy === "hnsw" || strategy === "ivf")) {
        errors.push("database.strategy: must be 'bruteforce' | 'hnsw' | 'ivf'");
      }
  }

  // index (partial)
  const ix = cfg.index as unknown;
  if (ix !== undefined && !isPlainObject(ix)) {
    errors.push("index: must be an object");
  }
  if (isPlainObject(ix)) {
      const shards = (ix as Record<string, unknown>).shards;
      const replicas = (ix as Record<string, unknown>).replicas;
      const pgs = (ix as Record<string, unknown>).pgs;
      const segmented = (ix as Record<string, unknown>).segmented;
      const segmentBytes = (ix as Record<string, unknown>).segmentBytes;
      const includeAnn = (ix as Record<string, unknown>).includeAnn;
      if (shards !== undefined && !(typeof shards === "number" && shards >= 1)) {
        errors.push("index.shards: must be number >= 1");
      }
      if (replicas !== undefined && !(typeof replicas === "number" && replicas >= 1)) {
        errors.push("index.replicas: must be number >= 1");
      }
      if (pgs !== undefined && !(typeof pgs === "number" && pgs >= 1)) {
        errors.push("index.pgs: must be number >= 1");
      }
      if (segmented !== undefined && typeof segmented !== "boolean") {
        errors.push("index.segmented: must be boolean");
      }
      if (segmentBytes !== undefined && !(typeof segmentBytes === "number" && segmentBytes > 0)) {
        errors.push("index.segmentBytes: must be positive number");
      }
      if (includeAnn !== undefined && typeof includeAnn !== "boolean") {
        errors.push("index.includeAnn: must be boolean");
      }
  }

  // server (partial)
  const srv = cfg.server as unknown;
  if (srv !== undefined && !isPlainObject(srv)) {
    errors.push("server: must be an object");
  }
  if (isPlainObject(srv)) {
      const port = (srv as Record<string, unknown>).port;
      if (port !== undefined && !(typeof port === "number" && port > 0 && port < 65536)) {
        errors.push("server.port: must be 1..65535");
      }
      const resultConsistency = (srv as Record<string, unknown>).resultConsistency;
      if (resultConsistency !== undefined && typeof resultConsistency !== "boolean") {
        errors.push("server.resultConsistency: must be boolean");
      }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

/** Validate a config file on disk by path; returns errors without throwing. */
export async function validateConfigFile(filePath = "vectordb.config.json"): Promise<ValidationResult & { path: string }> {
  const p = path.resolve(filePath);
  try {
    const raw = await fs.readFile(p, "utf8");
    const json = JSON.parse(raw) as unknown;
    const res = validateRawAppConfig(json);
    return { ...res, path: p };
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message?: unknown }).message) : String(e);
    return { ok: false, errors: [msg], path: p };
  }
}
