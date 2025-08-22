/**
 * @file UI components for Crush CLI visualization
 */

import { Box, Text, useInput } from "ink";
import React from "react";
import type { CrushTemplate, ShardAccess, ShardStats } from "./crush-cli-types";

export function TemplateSelector({
  templates,
  selectedIndex,
  onSelect,
}: {
  templates: CrushTemplate[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  useInput((input, key) => {
    if (key.upArrow) {
      onSelect(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      onSelect(Math.min(templates.length - 1, selectedIndex + 1));
    } else if (key.return) {
      onSelect(-1); // Signal selection complete
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        Select a CrushMap Template:
      </Text>
      <Text color="gray" dimColor>
        Use ↑/↓ arrows to navigate, Enter to select
      </Text>
      <Box marginTop={1} flexDirection="column">
        {templates.map((template, index) => (
          <Box key={index} marginBottom={1}>
            <Text color={selectedIndex === index ? "green" : "white"}>
              {selectedIndex === index ? "▶ " : "  "}
              <Text bold>{template.name}</Text>
            </Text>
            <Text color="gray" dimColor>
              {"    "}
              {template.description}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ShardVisualizer({
  stats,
  totalAccesses,
  currentAccess,
}: {
  stats: ShardStats;
  totalAccesses: number;
  currentAccess?: ShardAccess;
}) {
  const shards = Object.keys(stats).sort();
  const maxCount = Math.max(...Object.values(stats).map((s) => s.count), 1);

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        Shard Access Distribution (Total: {totalAccesses})
      </Text>
      <Box marginTop={1} flexDirection="column">
        {shards.map((shard) => {
          const stat = stats[shard];
          const barLength = Math.floor((stat.count / maxCount) * 40);
          const isActive = currentAccess?.shard === shard;

          return (
            <Box key={shard} marginBottom={1}>
              <Box width={20}>
                <Text color={isActive ? "yellow" : "white"} bold={isActive}>
                  {shard}:
                </Text>
              </Box>
              <Box>
                <Text color={isActive ? "yellow" : "green"}>
                  {"█".repeat(barLength)}
                  <Text color="gray">{"░".repeat(40 - barLength)}</Text>
                </Text>
              </Box>
              <Box marginLeft={2}>
                <Text color={isActive ? "yellow" : "white"}>
                  {stat.count} ({stat.percentage.toFixed(1)}%)
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function AccessLog({ accesses }: { accesses: ShardAccess[] }) {
  const recentAccesses = accesses.slice(-10).reverse();

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        Recent Accesses:
      </Text>
      <Box marginTop={1} flexDirection="column">
        {recentAccesses.map((access, index) => (
          <Text key={index} color={index === 0 ? "yellow" : "gray"} dimColor={index > 0}>
            ID: {String(access.id).padStart(6, "0")} → PG: {String(access.pg).padStart(3, "0")} → {access.shard}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

export function MapInfo({ template }: { template: CrushTemplate }) {
  return (
    <Box flexDirection="column">
      <Text color="magenta" bold>
        Current Map: {template.name}
      </Text>
      <Text color="gray">PGs: {template.map.pgs}</Text>
      <Text color="gray">Replicas: {template.map.replicas}</Text>
      <Text color="gray">Shards: {template.map.targets.length}</Text>
    </Box>
  );
}

export function Controls({ isRunning, onToggle }: { isRunning: boolean; onToggle: () => void }) {
  useInput((input) => {
    if (input === " ") {
      onToggle();
    } else if (input === "q") {
      process.exit(0);
    }
  });

  return (
    <Box marginTop={1}>
      <Text color="gray">
        Press <Text color="green">SPACE</Text> to {isRunning ? "pause" : "resume"} | <Text color="red">Q</Text> to quit
      </Text>
    </Box>
  );
}
