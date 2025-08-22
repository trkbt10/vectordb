/**
 * @file DatabaseExplorer: Rich database operation screen with registry list and data view
 */
import React, { useEffect, useMemo, useState } from "react";
import { Box } from "ink";

import { readRegistry, upsertRegistryEntry, discoverConfigs, writeRegistry } from "./registry";
import type { DatabaseRegistryEntry } from "../../../../../types/registry";
import { openFromConfig } from "./open_from_config";
import type { ClientWithDatabase } from "../../../../../client/index";
import { Runner } from "../../database-wizard/components/Runner";
import type { FlowSchema } from "../../database-wizard/components/FlowWizard";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { truncate } from "./utils";
import { useInput } from "ink";
import { StatsView } from "./views/StatsView";
import { RebuildView } from "./views/RebuildView";
import { QueryConfigView } from "./views/QueryConfigView";
import { useFooter } from "../../../FooterContext";
import { SearchHeader } from "./parts/SearchHeader";
import { queryToVector, queryToVectorOpenAI } from "./embedding";
import { Table } from "./parts/Table";
import { FooterBar } from "./parts/FooterBar";
import { RowActionModal } from "./parts/modal/RowActionModal";
import { EditMetaModal } from "./parts/modal/EditMetaModal";
import { IndexStrategyModal } from "./parts/modal/IndexStrategyModal";

type RecordRow = { id: number; meta: unknown; vector: Float32Array };

/**
 * DatabaseExplorer: left registry, right data view with header/table/status.
 */
export function DatabaseExplorer({
  configFlow,
  directConfigPath,
  onExit,
}: {
  configFlow?: FlowSchema;
  directConfigPath?: string;
  onExit?: () => void;
}) {
  const [registry, setRegistry] = useState<DatabaseRegistryEntry[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [client, setClient] = useState<ClientWithDatabase<Record<string, unknown>> | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState("");
  const [queryVec, setQueryVec] = useState<Float32Array | null>(null);
  const [searchFocus, setSearchFocus] = useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<"meta" | "vector">("meta");
  const [status, setStatus] = useState<string>("Ready");
  const [loading, setLoading] = useState<boolean>(false);
  const [wizard, setWizard] = useState<{ running: boolean }>({ running: false });
  const [panel, setPanel] = useState<"table" | "stats" | "rebuild">("table");
  const [rowIdx, setRowIdx] = useState<number>(0);
  const [showRowMenu, setShowRowMenu] = useState<boolean>(false);
  const [showEditMeta, setShowEditMeta] = useState<boolean>(false);
  const [metaEditing, setMetaEditing] = useState<boolean>(false);
  const [showIndexStrategy, setShowIndexStrategy] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<"bruteforce" | "hnsw" | "ivf" | undefined>(undefined);
  const [showQueryCfg, setShowQueryCfg] = useState<boolean>(false);
  const [queryCfg, setQueryCfg] = useState<
    { method: "auto" | "numeric" | "hash" | "openai"; name?: string } | undefined
  >(undefined);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [editMetaText, setEditMetaText] = useState<string>("");
  const footerActions = useMemo(
    () => [
      { label: "Search", value: "search" },
      { label: "PgUp", value: "pgup" },
      { label: "PgDn", value: "pgdn" },
      { label: "Stats / Diagnose", value: "stats" },
      { label: "Query Config", value: "qcfg" },
      { label: "Rebuild State", value: "rebuild" },
      { label: "Index Strategy", value: "index" },
      { label: "Back", value: "back" },
    ],
    [],
  );
  const [footerFocus, setFooterFocus] = useState<boolean>(false);
  const [footerIdx, setFooterIdx] = useState<number>(0);
  // filtered rows for view and footer summary
  const filteredMeta = useMemo(() => {
    if (!query) {
      return rows;
    }
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        String(r.id).includes(q) ||
        truncate(JSON.stringify(r.meta ?? null))
          .toLowerCase()
          .includes(q),
    );
  }, [rows, query]);
  const filteredVector = useMemo(() => {
    if (!client) {
      return rows;
    }
    const qv = queryVec ?? null;
    if (!qv) {
      return rows;
    }
    const hits = client.findMany(qv, { k: Math.min(500, rows.length) });
    const ids = new Set(hits.map((h) => h.id));
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    const ordered = hits.map((h) => byId.get(h.id)).filter((r): r is RecordRow => !!r);
    const tail = rows.filter((r) => !ids.has(r.id));
    return [...ordered, ...tail];
  }, [client, rows, queryVec]);

  // Compute query vector when query or method changes (supports async OpenAI)
  useEffect(() => {
    (async () => {
      if (!client) {
        return setQueryVec(null);
      }
      const dim = client.state.store.dim;
      const m = queryCfg?.method ?? "auto";
      if (m === "openai") {
        const v = await queryToVectorOpenAI(query, dim);
        setQueryVec(v);
        return;
      }
      if (m === "numeric") {
        const v = queryToVector(query, dim);
        setQueryVec(v && v.length === dim ? v : null);
        return;
      }
      if (m === "hash") {
        const v = query.trim() ? queryToVector(query, dim) : null;
        setQueryVec(v);
        return;
      }
      setQueryVec(queryToVector(query, dim));
    })();
  }, [client, query, queryCfg?.method]);
  const filtered = searchMode === "vector" ? filteredVector : filteredMeta;

  // Viewport scrolling (~30 rows)
  const viewport = 30;
  const [scroll, setScroll] = useState<number>(0);
  const start = Math.max(0, Math.min(scroll, Math.max(0, filtered.length - viewport)));
  const end = Math.min(start + viewport, filtered.length);
  const pageRows = filtered.slice(start, end);

  useEffect(() => {
    setRowIdx((i) => (pageRows.length === 0 ? 0 : Math.min(i, pageRows.length - 1)));
  }, [filtered.length, pageRows.length]);

  const footerNode = React.useMemo(() => {
    if (wizard.running) {
      return null;
    }
    return (
      <FooterBar
        status={status}
        total={rows.length}
        showing={filtered.length}
        page={start + rowIdx + 1}
        totalPages={filtered.length}
        per={30}
        actions={footerActions}
        focusIndex={footerFocus ? footerIdx : -1}
      />
    );
  }, [wizard.running, status, rows.length, filtered.length, start, rowIdx, footerActions, footerFocus, footerIdx]);
  useFooter(footerNode);

  const handleFooterAction = React.useCallback(
    (sel: string | undefined) => {
      if (!sel) {
        return;
      }
      if (sel === "search") {
        setSearchFocus(true);
        setFooterFocus(false);
        return;
      }
      if (sel === "pgup") {
        setFooterFocus(false);
        setScroll((s) => Math.max(0, s - 29));
        setRowIdx(0);
        return;
      }
      if (sel === "pgdn") {
        setFooterFocus(false);
        setScroll((s) => Math.min(s + 29, Math.max(0, filtered.length - 30)));
        setRowIdx(Math.min(29, filtered.length - 1));
        return;
      }
      if (sel === "stats" && client) {
        setPanel("stats");
        return;
      }
      if (sel === "rebuild" && client) {
        setPanel("rebuild");
        return;
      }
      if (sel === "qcfg") {
        setShowQueryCfg(true);
        setFooterFocus(false);
        return;
      }
      if (sel === "index") {
        setShowIndexStrategy(true);
        return;
      }
      if (sel === "back") {
        onExit?.();
      }
    },
    [client, onExit],
  );

  useInput((input, key) => {
    if (searchFocus) {
      if (key.escape) {
        setSearchFocus(false);
      }
      return;
    }
    if (input === "\t") {
      setFooterFocus((f) => !f);
      return;
    }
    if (showRowMenu || showEditMeta || showIndexStrategy) {
      if (key.escape) {
        if (showRowMenu) {
          setShowRowMenu(false);
        }
        if (showEditMeta && !metaEditing) {
          setShowEditMeta(false);
        }
        if (showIndexStrategy) {
          setShowIndexStrategy(false);
        }
      }
      return;
    }
    if (input === "/" || input === "s") {
      setSearchFocus(true);
      return;
    }
    if (key.leftArrow) {
      if (footerFocus) {
        setFooterIdx((i) => (i > 0 ? i - 1 : 0));
      }
      return;
    }
    if (key.rightArrow) {
      if (!footerFocus) {
        setFooterFocus(true);
        return;
      }
      setFooterIdx((i) => (i < footerActions.length - 1 ? i + 1 : i));
      return;
    }
    if (key.upArrow) {
      setFooterFocus(false);
      if (rowIdx > 0) {
        return setRowIdx((i) => i - 1);
      }
      if (start > 0) {
        setScroll((s) => Math.max(0, s - 1));
      }
      return;
    }
    if (key.downArrow) {
      setFooterFocus(false);
      if (rowIdx < pageRows.length - 1) {
        return setRowIdx((i) => i + 1);
      }
      if (end < filtered.length) {
        setScroll((s) => Math.min(s + 1, Math.max(0, filtered.length - 30)));
      }
      return;
    }
    if (key.pageUp) {
      setFooterFocus(false);
      setScroll((s) => Math.max(0, s - 29));
      setRowIdx(0);
      return;
    }
    if (key.pageDown) {
      setFooterFocus(false);
      setScroll((s) => Math.min(s + 29, Math.max(0, filtered.length - 30)));
      setRowIdx(Math.min(29, filtered.length - 1));
      return;
    }
    if (input === "v") {
      setSearchMode((m) => (m === "meta" ? "vector" : "meta"));
      setStatus(`Search mode: ${searchMode === "meta" ? "vector" : "meta"}`);
      return;
    }
    if (key.return) {
      if (footerFocus) {
        return handleFooterAction(footerActions[footerIdx]?.value);
      }
      if (pageRows[rowIdx]) {
        setSelectedIdx(rowIdx);
        setShowRowMenu(true);
      }
    }
  });

  useEffect(() => {
    (async () => {
      if (directConfigPath) {
        setLoading(true);
        try {
          const c = await openFromConfig(directConfigPath);
          setClient(c);
          try {
            const raw = await readFile(path.resolve(directConfigPath), "utf8");
            const cfg = JSON.parse(raw) as {
              query?: { embed?: { method?: "auto" | "numeric" | "hash" | "openai"; name?: string } };
            };
            const embed = cfg.query?.embed;
            if (
              embed &&
              (embed.method === "auto" ||
                embed.method === "numeric" ||
                embed.method === "hash" ||
                embed.method === "openai")
            ) {
              setQueryCfg({ method: embed.method, name: embed.name });
            }
          } catch {
            // ignore JSON read errors
          }
          const s = c.state;
          const out: RecordRow[] = [];
          const max = s.store._count;
          for (let i = 0; i < max; i++) {
            const id = s.store.ids[i];
            const vec = s.store.data.slice(i * s.store.dim, i * s.store.dim + s.store.dim);
            out.push({ id, meta: s.store.metas[i], vector: vec });
          }
          setRows(out);
          setStatus(`Opened ${directConfigPath}`);
          setSelected(-1);
        } catch (e) {
          const m = (e as { message?: unknown })?.message;
          setStatus(`Error: ${String(m ?? e)}`);
        } finally {
          setLoading(false);
        }
        return;
      }
      const r = await readRegistry();
      if (r.entries.length === 0) {
        const found = await discoverConfigs();
        if (found.length > 0) {
          await writeRegistry({ entries: found });
          setRegistry(found);
          return;
        }
      }
      setRegistry(r.entries);
    })();
  }, [directConfigPath]);

  async function loadSelected(idx: number) {
    const item = registry[idx];
    if (!item) {
      return;
    }
    setLoading(true);
    try {
      const c = await openFromConfig(item.configPath);
      setClient(c);
      try {
        const raw = await readFile(path.resolve(item.configPath), "utf8");
        const cfg = JSON.parse(raw) as {
          query?: { embed?: { method?: "auto" | "numeric" | "hash" | "openai"; name?: string } };
        };
        const embed = cfg.query?.embed;
        if (
          embed &&
          (embed.method === "auto" ||
            embed.method === "numeric" ||
            embed.method === "hash" ||
            embed.method === "openai")
        ) {
          setQueryCfg({ method: embed.method, name: embed.name });
        }
      } catch {
        // ignore JSON read errors
      }
      const s = c.state;
      const out: RecordRow[] = [];
      const max = s.store._count;
      for (let i = 0; i < max; i++) {
        const id = s.store.ids[i];
        const vec = s.store.data.slice(i * s.store.dim, i * s.store.dim + s.store.dim);
        out.push({ id, meta: s.store.metas[i], vector: vec });
      }
      setRows(out);
      setStatus(`Loaded ${out.length} rows from ${item.name}`);
      // default to table only
    } catch (e) {
      const m = (e as { message?: unknown })?.message;
      setStatus(`Error: ${String(m ?? e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (directConfigPath) {
        return;
      } // skip wizard logic when direct open
      if (client) {
        return;
      } // already opened
      if (registry.length > 0 && selected === -1) {
        void loadSelected(0);
        setSelected(0);
        return;
      }
      if (registry.length === 0 && !wizard.running && configFlow) {
        setWizard({ running: true });
        setStatus("No database entries. Launching wizard...");
      }
    })();
  }, [registry, selected, configFlow, wizard.running, directConfigPath, client]);

  // Left registry/menu removed; auto-select first entry if available.

  async function onWizardSaved(p: string) {
    try {
      // load name from config to create registry entry
      const raw = await readFile(path.resolve(p), "utf8");
      const cfg = JSON.parse(raw) as { name?: string };
      const name = cfg?.name || `db-${new Date().toISOString()}`;
      const reg = await upsertRegistryEntry({ name, configPath: p });
      setRegistry(reg.entries);
      setStatus(`Created ${name}`);
      setWizard({ running: false });
      await loadSelected(reg.entries.length - 1);
    } catch (e) {
      const m = (e as { message?: unknown })?.message;
      setStatus(`Wizard saved but failed to register: ${String(m ?? e)}`);
      setWizard({ running: false });
    }
  }

  // Inline dialog centering (overlay removed)
  if (wizard.running && configFlow) {
    return (
      <Box flexDirection="column">
        <Runner
          flow={configFlow}
          onCancel={() => setWizard({ running: false })}
          onSaved={(p) => void onWizardSaved(p)}
        />
      </Box>
    );
  }

  const mainPanel: React.ReactNode = (() => {
    if (panel === "table") {
      return <Table rows={pageRows} allRows={rows} rowIdx={rowIdx} loading={loading} />;
    }
    if (panel === "stats" && client) {
      return (
        <StatsView
          ctx={{ name: registry[selected]?.name ?? "db", client, selectedStrategy, query: queryCfg }}
          onBack={() => setPanel("table")}
        />
      );
    }
    if (panel === "rebuild" && client) {
      return (
        <RebuildView
          ctx={{ name: registry[selected]?.name ?? "db", client, selectedStrategy, query: queryCfg }}
          onBack={() => setPanel("table")}
        />
      );
    }
    return <Box />;
  })();
  const rowMenu: React.ReactNode = (() => {
    if (!showRowMenu) {
      return null;
    }
    return (
      <RowActionModal
        open={showRowMenu}
        rowId={pageRows[selectedIdx]?.id}
        onCancel={() => setShowRowMenu(false)}
        onDelete={() => {
          const rid = pageRows[selectedIdx]?.id;
          if (rid != null) {
            client?.delete(rid);
            setRows((rs) => rs.filter((r) => r.id !== rid));
            setStatus(`Deleted id ${rid}`);
          }
          setShowRowMenu(false);
        }}
        onEdit={() => {
          const mt = JSON.stringify(pageRows[selectedIdx]?.meta ?? null);
          setEditMetaText(mt);
          setShowRowMenu(false);
          setShowEditMeta(true);
        }}
      />
    );
  })();
  // legacy editMeta block removed (inlined below)
  const indexStrategy: React.ReactNode = (() => {
    if (!showIndexStrategy) {
      return null;
    }
    return (
      <IndexStrategyModal
        open={showIndexStrategy}
        onCancel={() => setShowIndexStrategy(false)}
        onSelect={(strategy: string) => {
          setStatus(`Selected index strategy: ${strategy} (apply via Rebuild)`);
          if (strategy === "bruteforce" || strategy === "hnsw" || strategy === "ivf") {
            setSelectedStrategy(strategy);
          }
          setShowIndexStrategy(false);
        }}
      />
    );
  })();
  return (
    <Box flexDirection="column" flexGrow={1}>
      <SearchHeader query={query} onChange={setQuery} isFocused={searchFocus} />
      {mainPanel}
      {rowMenu}
      {(() => {
        if (!showEditMeta) {
          return null;
        }
        return (
          <Box width="100%" flexGrow={1} alignItems="center" justifyContent="center">
            <EditMetaModal
              open={showEditMeta}
              initialMetaText={editMetaText}
              onCancel={() => setShowEditMeta(false)}
              onEditingChange={(e) => setMetaEditing(e)}
              onSave={(text: string) => {
                try {
                  const rid = pageRows[selectedIdx]?.id;
                  const vec = pageRows[selectedIdx]?.vector;
                  const meta = text ? JSON.parse(text) : null;
                  if (rid != null && vec) {
                    client?.set(rid, { vector: vec, meta }, { upsert: true });
                  }
                  setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, meta } : r)));
                  setStatus(`Updated id ${rid}`);
                  setShowEditMeta(false);
                } catch (e) {
                  setStatus(`Update failed: ${String((e as { message?: unknown })?.message ?? e)}`);
                }
              }}
            />
          </Box>
        );
      })()}
      {indexStrategy}
      {(() => {
        if (!showQueryCfg) {
          return null;
        }
        if (!client) {
          return (
            <Box width="100%" flexGrow={1} alignItems="center" justifyContent="center">
              <Box />
            </Box>
          );
        }
        return (
          <Box width="100%" flexGrow={1} alignItems="center" justifyContent="center">
            <QueryConfigView
              ctx={{ name: registry[selected]?.name ?? "db", client, selectedStrategy, query: queryCfg }}
              onBack={() => setShowQueryCfg(false)}
            />
          </Box>
        );
      })()}
    </Box>
  );
}
