/**
 * @file Default configuration FlowSchema for quick project setup.
 */
import type { FlowSchema } from "../FlowWizard";
import { DEFAULT_CONFIG_STEM } from "../../../../../../config";

export const defaultConfigFlow: FlowSchema = {
  title: "Config Wizard",
  start: "intent",
  display: [],
  steps: {
    intent: {
      type: "menu",
      id: "intent",
      title: "Choose Intent",
      description: ["Pick why you want persistence:"],
      items: [
        { label: "Local (filesystem)", next: "all", value: "local", tooltip: "Store data on local disk (simple)." },
        {
          label: "Browser (OPFS)",
          next: "all",
          value: "browser",
          tooltip: "Use the browser's Origin Private File System.",
        },
        {
          label: "Ephemeral (memory)",
          next: "all",
          value: "memory",
          tooltip: "In-memory only; fast but not persisted.",
        },
        {
          label: "Shared/Prod (filesystem, advanced)",
          next: "all",
          value: "shared",
          tooltip: "Filesystem with advanced layout for shared/prod.",
        },
      ],
      storeTo: "intent",
    },
    all: {
      type: "form",
      id: "all",
      title: "Project Configuration",
      description: ["Fill out all fields. Only relevant options are used based on Intent and Strategy."],
      fields: [
        { type: "group", label: "Project" },
        { type: "text", name: "name", label: "Project Name", defaultValue: "db" },
        { type: "text", name: "baseDir", label: "Base Directory", defaultValue: ".vectordb" },

        { type: "group", label: "Database" },
        { type: "text", name: "dim", label: "Dimensions", defaultValue: "3" },
        {
          type: "select",
          name: "metric",
          label: "Metric",
          options: [
            { label: "cosine", value: "cosine" },
            { label: "l2", value: "l2" },
            { label: "dot", value: "dot" },
          ],
        },
        {
          type: "select",
          name: "strategy",
          label: "Strategy",
          options: [
            { label: "bruteforce", value: "bruteforce" },
            { label: "hnsw", value: "hnsw" },
            { label: "ivf", value: "ivf" },
          ],
        },
        { type: "text", name: "hnswM", label: "HNSW: M", defaultValue: "16" },
        { type: "text", name: "hnswEfSearch", label: "HNSW: efSearch", defaultValue: "64" },
        { type: "text", name: "ivfNlist", label: "IVF: nlist", defaultValue: "1024" },

        { type: "group", label: "Index" },
        { type: "text", name: "shards", label: "Shards", defaultValue: "1" },
        { type: "text", name: "replicas", label: "Replicas", defaultValue: "1" },
        { type: "text", name: "pgs", label: "PGs", defaultValue: "64" },
        { type: "boolean", name: "segmented", label: "Segmented (Yes/No)" },
        { type: "boolean", name: "includeAnn", label: "Include ANN in snapshot?" },

        { type: "group", label: "Output" },
        { type: "text", name: "savePath", label: "Save Path", defaultValue: `./${DEFAULT_CONFIG_STEM}.mjs` },
      ],
      allowBack: false,
      defaultNext: "writeConfig",
    },
    writeConfig: {
      type: "write",
      id: "writeConfig",
      pathFrom: (a) => String(a.savePath || `./${DEFAULT_CONFIG_STEM}.mjs`),
      dataFrom: (a) => {
        const name = String(a.name || "db");
        const intent = String(a.intent || "local");
        const base = String(a.baseDir || ".vectordb");
        const storageDecl = (() => {
          if (intent === "memory" || intent === "browser") {
            return `index: createMemoryFileIO(),\n    data: () => createMemoryFileIO()`;
          }
          return `index: createNodeFileIO('${base}/index'),\n    data: (ns) => createNodeFileIO('${base}/data/' + ns)`;
        })();
        const databaseBase = {
          dim: Number(a.dim || 3) || 3,
          metric: (a.metric as "cosine" | "l2" | "dot") || "cosine",
          strategy: (a.strategy as "bruteforce" | "hnsw" | "ivf") || "bruteforce",
        } as const;
        const hnswPart =
          a.strategy === "hnsw" ? { M: Number(a.hnswM || 16) || 16, efSearch: Number(a.hnswEfSearch || 64) || 64 } : {};
        const ivfPart = a.strategy === "ivf" ? { nlist: Number(a.ivfNlist || 1024) || 1024 } : {};
        const database = { ...databaseBase, ...hnswPart, ...ivfPart };
        const index = {
          name,
          includeAnn: Boolean(a.includeAnn ?? false),
          shards: Number(a.shards || 1) || 1,
          replicas: Number(a.replicas || 1) || 1,
          pgs: Number(a.pgs || 64) || 64,
          segmented: Boolean(a.segmented ?? true),
        };
        // Return JS ESM config content as a string
        const js = `/** @file VectorDB executable config */\nimport { defineConfig } from 'vcdb/http-server';\nimport { createNodeFileIO } from 'vcdb/storage/node';\nimport { createMemoryFileIO } from 'vcdb/storage/memory';\n\nexport default defineConfig({\n  name: '${name}',\n  storage: {\n    ${storageDecl}\n  },\n  database: ${JSON.stringify(database)},\n  index: ${JSON.stringify(index)},\n  server: {\n    resultConsistency: true\n  }\n});\n`;
        return js;
      },
    },
  },
};
