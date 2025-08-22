/**
 * @file Table: paged table renderer with zebra stripes and shallow meta expansion
 */
import React from "react";
import { Box, Text } from "ink";
import { truncate, vectorPreview } from "../utils";
import { isShallowObject } from "./utils";

export type RecordRow = { id: number; meta: unknown; vector: Float32Array };

/**
 * TableBase
 * Renders header and rows for the current page. Memoized export as Table.
 */
function TableBase({
  rows,
  allRows,
  rowIdx,
  loading,
}: {
  rows: RecordRow[];
  allRows: RecordRow[];
  rowIdx: number;
  loading: boolean;
}) {
  const { idW, vecW, metaAreaW } = React.useMemo(() => {
    const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
    const idW = 8;
    const minVecW = 24;
    const vecW = Math.max(minVecW, Math.floor((cols - idW) * 0.4));
    const metaAreaW = Math.max(20, cols - idW - vecW);
    return { idW, vecW, metaAreaW };
  }, [process.stdout?.columns]);

  const { metaCols, metaWidths } = React.useMemo(() => {
    const allKeys: string[] = [];
    for (const r of allRows.slice(0, 200)) {
      if (isShallowObject(r.meta)) {
        for (const k of Object.keys(r.meta)) if (!allKeys.includes(k)) allKeys.push(k);
      }
    }
    const maxCols = Math.max(1, Math.floor(metaAreaW / 12));
    const metaCols = allKeys.slice(0, maxCols);
    const metaColWBase = Math.floor(metaAreaW / Math.max(1, metaCols.length || 1));
    const metaWidths: number[] = metaCols.length > 0
      ? metaCols.map((_, i) => (i === metaCols.length - 1 ? metaAreaW - metaColWBase * (metaCols.length - 1) : metaColWBase))
      : [metaAreaW];
    return { metaCols, metaWidths };
  }, [allRows, metaAreaW]);

  const idH = React.useMemo(() => "ID".padEnd(idW, " "), [idW]);
  const metaH = React.useMemo(() => (
    metaCols.length > 0
      ? metaCols.map((k, i) => k.slice(0, metaWidths[i]).padEnd(metaWidths[i], " ")).join("")
      : "Meta".slice(0, metaAreaW).padEnd(metaAreaW, " ")
  ), [metaCols, metaWidths, metaAreaW]);
  const vecH = React.useMemo(() => "Vector".slice(0, vecW).padEnd(vecW, " "), [vecW]);
  const header = `${idH}${metaH}${vecH}`;

  return (
    <Box flexDirection="column">
      <Text>{header}</Text>
      <Text color="gray">{"─".repeat(Math.max(40, (process.stdout?.columns ?? 80) - 2))}</Text>
      {loading ? (
        <Text color="gray">Loading...</Text>
      ) : (
        rows.map((r, i) => {
          const selected = i === rowIdx;
          const even = i % 2 === 1;
          const bg = selected ? "yellow" : even ? "gray" : undefined;
          const fg = selected ? "black" : undefined;
          const idStr = String(r.id).slice(0, idW).padEnd(idW, " ");
          const shallow = metaCols.length > 0 && isShallowObject(r.meta);
          const metaStr = shallow
            ? metaCols
                .map((k, idx) => {
                  const v = (r.meta as Record<string, unknown>)[k];
                  const s = v == null ? "" : String(v);
                  return s.slice(0, metaWidths[idx]).padEnd(metaWidths[idx], " ");
                })
                .join("")
            : (() => {
                const s = truncate(JSON.stringify(r.meta ?? null), metaAreaW);
                return s.slice(0, metaAreaW).padEnd(metaAreaW, " ");
              })();
          const vecText = vectorPreview(r.vector);
          const vecStr = vecText.length > vecW ? vecText.slice(0, vecW) : vecText.padEnd(vecW, " ");
          const line = `${idStr}${metaStr}${vecStr}`;
          return (
            <Text key={r.id} backgroundColor={bg} color={fg}>
              {line}
            </Text>
          );
        })
      )}
    </Box>
  );
}

export const Table = React.memo(TableBase);
