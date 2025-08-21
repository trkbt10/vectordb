/**
 * @file Default configuration FlowSchema for quick project setup.
 */
import type { FlowSchema } from "../FlowWizard";

export const defaultConfigFlow: FlowSchema = {
  title: "Config Wizard",
  start: "storage",
  steps: {
    storage: {
      type: "menu",
      id: "storage",
      title: "Choose Storage",
      description: "Select persistence target (Node.js, Browser OPFS, or Memory)",
      items: [
        { label: "Node.js (filesystem)", next: "name", value: "node" },
        { label: "Browser (OPFS)", next: "name", value: "opfs" },
        { label: "Memory (ephemeral)", next: "name", value: "memory" },
      ],
      storeTo: "storageKind",
    },
    name: {
      type: "ui",
      id: "name",
      title: "Project Name",
      field: { type: "text", name: "name", label: "Name", defaultValue: "db" },
      transitions: [{ when: { op: "equals", field: "storageKind", value: "node" }, next: "nodeIndexRoot" }],
      defaultNext: "dbDim",
      allowBack: true,
    },
    nodeIndexRoot: { type: "ui", id: "nodeIndexRoot", title: "Node.js Storage", field: { type: "text", name: "indexRoot", label: "Index Root", defaultValue: ".vectordb" }, allowBack: true, defaultNext: "nodeDataRoot" },
    nodeDataRoot: { type: "ui", id: "nodeDataRoot", title: "Node.js Storage", field: { type: "text", name: "dataRoot", label: "Data Root", defaultValue: ".vectordb/data" }, allowBack: true, defaultNext: "dbDim" },
    dbDim: { type: "ui", id: "dbDim", title: "Database Dimensions", field: { type: "text", name: "dim", label: "Dimensions", defaultValue: "3" }, allowBack: true, defaultNext: "dbMetric" },
    dbMetric: { type: "ui", id: "dbMetric", title: "Database Metric", field: { type: "select", name: "metric", label: "Metric", options: [{ label: "cosine", value: "cosine" }, { label: "l2", value: "l2" }, { label: "dot", value: "dot" }] }, allowBack: true, defaultNext: "dbStrategy" },
    dbStrategy: {
      type: "ui",
      id: "dbStrategy",
      title: "Index Strategy",
      field: { type: "select", name: "strategy", label: "Strategy", options: [{ label: "bruteforce", value: "bruteforce" }, { label: "hnsw", value: "hnsw" }, { label: "ivf", value: "ivf" }] },
      allowBack: true,
      transitions: [
        { when: { op: "equals", field: "strategy", value: "hnsw" }, next: "hnswM" },
        { when: { op: "equals", field: "strategy", value: "ivf" }, next: "ivfNlist" },
      ],
      defaultNext: "placeShards",
    },
    hnswM: { type: "ui", id: "hnswM", title: "HNSW Parameters", field: { type: "text", name: "hnswM", label: "M", defaultValue: "16" }, allowBack: true, defaultNext: "hnswEfSearch" },
    hnswEfSearch: { type: "ui", id: "hnswEfSearch", title: "HNSW Parameters", field: { type: "text", name: "hnswEfSearch", label: "efSearch", defaultValue: "64" }, allowBack: true, defaultNext: "placeShards" },
    ivfNlist: { type: "ui", id: "ivfNlist", title: "IVF Parameters", field: { type: "text", name: "ivfNlist", label: "nlist", defaultValue: "1024" }, allowBack: true, defaultNext: "placeShards" },
    placeShards: { type: "ui", id: "placeShards", title: "Placement", field: { type: "text", name: "shards", label: "Shards", defaultValue: "1" }, allowBack: true, defaultNext: "placeReplicas" },
    placeReplicas: { type: "ui", id: "placeReplicas", title: "Placement", field: { type: "text", name: "replicas", label: "Replicas", defaultValue: "1" }, allowBack: true, defaultNext: "placePgs" },
    placePgs: { type: "ui", id: "placePgs", title: "Placement", field: { type: "text", name: "pgs", label: "PGs", defaultValue: "64" }, allowBack: true, defaultNext: "segmented" },
    segmented: { type: "ui", id: "segmented", title: "Placement", field: { type: "boolean", name: "segmented", label: "Segmented (Yes/No)" }, allowBack: true, defaultNext: "includeAnn" },
    includeAnn: { type: "ui", id: "includeAnn", title: "Snapshot", field: { type: "boolean", name: "includeAnn", label: "Include ANN index in snapshot?" }, allowBack: true, defaultNext: "savePath" },
    savePath: { type: "ui", id: "savePath", title: "Save Config", field: { type: "text", name: "savePath", label: "Path", defaultValue: "./vectordb.config.json" }, allowBack: true, defaultNext: "writeConfig" },
    writeConfig: {
      type: "write",
      id: "writeConfig",
      pathFrom: (a) => String(a.savePath || "./vectordb.config.json"),
      dataFrom: (a) => ({
        name: String(a.name || "db"),
        storage: (() => {
          const kind = String(a.storageKind || "memory");
          if (kind === "node") return { type: "node", indexRoot: a.indexRoot || ".vectordb", dataRoot: a.dataRoot || ".vectordb/data" };
          if (kind === "opfs") return { type: "opfs" };
          return { type: "memory" };
        })(),
        database: {
          dim: Number(a.dim || 3) || 3,
          metric: (a.metric as "cosine" | "l2" | "dot") || "cosine",
          strategy: (a.strategy as "bruteforce" | "hnsw" | "ivf") || "bruteforce",
          ...(a.strategy === "hnsw" ? { M: Number(a.hnswM || 16) || 16, efSearch: Number(a.hnswEfSearch || 64) || 64 } : {}),
          ...(a.strategy === "ivf" ? { nlist: Number(a.ivfNlist || 1024) || 1024 } : {}),
        },
        index: {
          name: String(a.name || "db"),
          includeAnn: Boolean(a.includeAnn ?? false),
          shards: Number(a.shards || 1) || 1,
          replicas: Number(a.replicas || 1) || 1,
          pgs: Number(a.pgs || 64) || 64,
          segmented: Boolean(a.segmented ?? true),
        },
      }),
    },
  },
};
