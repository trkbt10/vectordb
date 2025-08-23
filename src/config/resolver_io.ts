/**
 * @file IO resolver registry for config normalization (scheme -> FileIO)
 */
import path from "node:path";
import type { FileIO } from "../storage/types";

export type IORegistry = Record<
  string,
  {
    indexFactory?: (url: URL, options?: unknown) => FileIO;
    dataFactory?: (url: URL, ns: string, options?: unknown) => FileIO;
  }
>;

/**
 *
 */
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

import { createNodeFileIO } from "../storage/node";
import { createMemoryFileIO } from "../storage/memory";

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

/**
 *
 */
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

export type DataIOResolver = FileIO | ((targetKey: string) => FileIO);
export type StorageConfig = { index: FileIO; data: DataIOResolver };

/**
 *
 */
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
        return out;
      }
      if (prov.indexFactory) {
        const out = prov.indexFactory(url);
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
