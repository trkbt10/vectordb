/**
 * @file DatabaseExplorer: Rich database operation screen with registry list and data view
 */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { readRegistry, upsertRegistryEntry, discoverConfigs, writeRegistry } from "./registry";
import type { DatabaseRegistryEntry } from "../../../../../types/registry";
import { openFromConfig } from "./open_from_config";
import type { ClientWithDatabase } from "../../../../../client/index";
import { Runner } from "../../database-wizard/components/Runner";
import type { FlowSchema } from "../../database-wizard/components/FlowWizard";
import { readFile } from "node:fs/promises";
import path from "node:path";

type RecordRow = { id: number; meta: unknown; vector: Float32Array };

function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function vectorPreview(v: Float32Array, max = 3): string {
  if (!v || v.length === 0) return "[]";
  const parts = Array.from(v.slice(0, max)).map((x) => Number.isFinite(x) ? x.toFixed(3) : String(x));
  return `[${parts.join(", ")}${v.length > max ? ", …" : ""}]`;
}

/**
 * DatabaseExplorer: left registry, right data view with header/table/status.
 */
export function DatabaseExplorer({ configFlow }: { configFlow?: FlowSchema }) {
  const [registry, setRegistry] = useState<DatabaseRegistryEntry[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [client, setClient] = useState<ClientWithDatabase<Record<string, unknown>> | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("Ready");
  const [loading, setLoading] = useState<boolean>(false);
  const [wizard, setWizard] = useState<{ running: boolean }>({ running: false });

  useEffect(() => {
    (async () => {
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
  }, []);

  async function loadSelected(idx: number) {
    const item = registry[idx];
    if (!item) return;
    setLoading(true);
    try {
      const c = await openFromConfig(item.configPath);
      setClient(c);
      const s = c.state;
      const out: RecordRow[] = [];
      const max = Math.min(s.store._count, 50);
      for (let i = 0; i < max; i++) {
        const id = s.store.ids[i];
        const vec = s.store.data.slice(i * s.store.dim, i * s.store.dim + s.store.dim);
        out.push({ id, meta: s.store.metas[i], vector: vec });
      }
      setRows(out);
      setStatus(`Loaded ${out.length} rows from ${item.name}`);
    } catch (e) {
      const m = (e as { message?: unknown })?.message;
      setStatus(`Error: ${String(m ?? e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
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
  }, [registry, selected, configFlow, wizard.running]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => String(r.id).includes(q) || truncate(JSON.stringify(r.meta ?? null)).toLowerCase().includes(q));
  }, [rows, query]);

  const items = useMemo(() => {
    const base = registry.map((e, i) => ({ label: `${e.name}  (${e.configPath})`, value: String(i) }));
    return configFlow ? [...base, { label: "Create Config (Wizard)", value: "__wizard" }] : base;
  }, [registry, configFlow]);


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

  if (wizard.running && configFlow) {
    return (
      <Box flexDirection="column">
        <Runner flow={configFlow} onCancel={() => setWizard({ running: false })} onSaved={(p) => void onWizardSaved(p)} />
      </Box>
    );
  }

  return (
    <Box flexDirection="row">
      {/* Left pane: registry */}
      <Box flexDirection="column" width={32}>
        <Text color="cyan">Databases</Text>
        <Text color="gray">────────────────────────────</Text>
        {items.length > 0 ? (
          <SelectInput
            items={items}
            onSelect={(i) => {
              if (!i) return;
              const val = (i as { value?: string }).value;
              if (!val) return;
              if (val === "__wizard") {
                setWizard({ running: true });
                return;
              }
              const idx = Number(val);
              if (!Number.isNaN(idx)) {
                setSelected(idx);
                void loadSelected(idx);
              }
            }}
          />
        ) : (
          <Text color="gray">No entries</Text>
        )}
        {!configFlow && registry.length === 0 && <Text color="gray">No entries</Text>}
        {configFlow && registry.length === 0 && <Text color="yellow">No entries. Use Wizard to create.</Text>}
      </Box>

      {/* Vertical separator */}
      <Box width={1}><Text color="gray">│</Text></Box>

      {/* Right pane: data view */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Header */}
        <Box>
          <Box width="100%" justifyContent="space-between">
            <Box>
              <Text>Search: </Text>
              <TextInput value={query} onChange={setQuery} />
            </Box>
            <Text color="yellow">[Filters]</Text>
          </Box>
        </Box>
        <Text color="gray">────────────────────────────────────────────────────────────────────────</Text>

        {/* Table */}
        <Box flexDirection="column">
          <Box>
            <Box width={8}><Text>ID</Text></Box>
            <Box width={40}><Text>Meta</Text></Box>
            <Box flexGrow={1}><Text>Vector</Text></Box>
          </Box>
          <Text color="gray">────────────────────────────────────────────────────────────────────────</Text>
          {loading ? (
            <Text color="gray">Loading...</Text>
          ) : (
            filtered.map((r) => (
              <Box key={r.id}>
                <Box width={8}><Text>{r.id}</Text></Box>
                <Box width={40}><Text>{truncate(JSON.stringify(r.meta ?? null), 38)}</Text></Box>
                <Box flexGrow={1}><Text>{vectorPreview(r.vector)}</Text></Box>
              </Box>
            ))
          )}
          {client && !loading && filtered.length === 0 && (
            <Text color="gray">No rows match the query.</Text>
          )}
        </Box>

        {/* Status bar */}
        <Text color="gray">────────────────────────────────────────────────────────────────────────</Text>
        <Box>
          <Text>{status}  •  total: {rows.length}  •  showing: {filtered.length}</Text>
        </Box>
      </Box>
    </Box>
  );
}

