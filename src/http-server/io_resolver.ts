/**
 * @file FileIO resolver utilities for the server layer
 * Responsibility: Convert URI-like config into concrete FileIOs via a registry of drivers.
 */
import path from "node:path";
import { createNodeFileIO } from "../storage/node";
import { createMemoryFileIO } from "../storage/memory";
import type { FileIO } from "../storage/types";
import type { StorageConfig } from "../client/indexing";

export type IORegistry = Record<
  string,
  {
    indexFactory?: (url: URL, options?: unknown) => FileIO;
    dataFactory?: (url: URL, ns: string, options?: unknown) => FileIO;
  }
>;

export type RawDriverEntry = { module: string; export?: string; options?: unknown };

/** Parse string into URL, defaulting to file: for paths. */
export function toURL(u: string): URL {
  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u);
    if (hasScheme) {
      return new URL(u);
    }
    return new URL(`file:${u}`);
  } catch {
    return new URL(`file:${u}`);
  }
}

/** Built-in resolvers: Node FS (file:) and in-memory (mem:). */
export const builtinRegistry: IORegistry = {
  file: {
    indexFactory: (url) => createNodeFileIO(url.pathname || url.href.replace(/^file:/, "")),
    dataFactory: (url, ns) => {
      const base = url.pathname || url.href.replace(/^file:/, "");
      return createNodeFileIO(path.join(base, ns));
    },
  },
  mem: {
    indexFactory: () => createMemoryFileIO(),
    dataFactory: () => createMemoryFileIO(),
  },
};

// Dynamic drivers intentionally not implemented here (lint/policy).

/** Merge multiple IO registries; later entries override earlier ones. */
export function mergeRegistry(...regs: (IORegistry | undefined)[]): IORegistry {
  const out: IORegistry = {};
  for (const r of regs) {
    if (!r) {
      continue;
    }
    for (const [k, v] of Object.entries(r)) {
      out[k] = { ...out[k], ...v };
    }
  }
  return out;
}

/** Create concrete StorageConfig from raw URI config using a registry. */
export function createStorageFromRaw(
  raw: { index: string; data: string | Record<string, string> },
  registry: IORegistry,
): StorageConfig {
  const idxURL = toURL(raw.index);
  const idxScheme = idxURL.protocol.replace(":", "");
  const idxFactory = registry[idxScheme]?.indexFactory;
  if (!idxFactory) {
    throw new Error(`No index resolver for scheme: ${idxURL.protocol}`);
  }

  const resolveData = (() => {
    const dataCfg = raw.data;
    const makeFromTemplate = (template: string, ns: string): FileIO => {
      const replaced = template.indexOf("{ns}") !== -1 ? template.split("{ns}").join(ns) : template;
      const url = toURL(replaced);
      const scheme = url.protocol.replace(":", "");
      const prov = registry[scheme];
      if (!prov) {
        throw new Error(`No resolver for scheme: ${url.protocol}`);
      }
      if (prov.dataFactory) {
        const out = prov.dataFactory(url, ns);
        if (!isFileIO(out)) {
          throw new Error(`Data resolver for scheme ${url.protocol} did not return a FileIO`);
        }
        return out;
      }
      if (prov.indexFactory) {
        const out = prov.indexFactory(url);
        if (!isFileIO(out)) {
          throw new Error(`Index resolver for scheme ${url.protocol} did not return a FileIO`);
        }
        return out;
      }
      throw new Error(`No data/index factory for scheme: ${url.protocol}`);
    };
    if (typeof dataCfg === "string") {
      return (ns: string) => makeFromTemplate(dataCfg, ns);
    }
    const cache = new Map<string, FileIO>();
    const entries = Object.entries(dataCfg);
    for (const [, v] of entries) {
      if (typeof v !== "string") {
        throw new Error("storage.data map values must be strings (URIs)");
      }
    }
    return (ns: string) => {
      const uri = (() => {
        for (const [k, v] of entries) {
          if (k === ns) {
            return v;
          }
        }
        return undefined;
      })();
      if (!uri) {
        throw new Error(`No data URI configured for target key '${ns}'`);
      }
      const existing = cache.get(ns);
      if (existing) {
        return existing;
      }
      const created = makeFromTemplate(uri, ns);
      cache.set(ns, created);
      return created;
    };
  })();

  return { index: idxFactory(idxURL), data: resolveData };
}

/** Narrow unknown to FileIO by checking required methods. */
function isFileIO(x: unknown): x is FileIO {
  if (!x || typeof x !== "object") {
    return false;
  }
  const obj = x as { [k: string]: unknown };
  if (typeof obj.read !== "function") {
    return false;
  }
  if (typeof obj.write !== "function") {
    return false;
  }
  if (typeof obj.append !== "function") {
    return false;
  }
  if (typeof obj.atomicWrite !== "function") {
    return false;
  }
  return true;
}
