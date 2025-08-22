#!/usr/bin/env bun
/**
 * @file Crush CLI - Visualize shard access patterns
 */

import { Box, render } from "ink";
import React, { useEffect, useState } from "react";
import { crushLocate } from "../../src/indexing/placement/crush";
import { AccessLog, Controls, MapInfo, ShardVisualizer, TemplateSelector } from "./crush-cli-components";
import { CRUSH_TEMPLATES } from "./crush-cli-templates";
import type { AppState, CrushTemplate, ShardAccess, ShardStats } from "./crush-cli-types";

function App() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState<AppState>({
    selectedTemplate: null,
    isRunning: false,
    accesses: [],
    stats: {},
    totalAccesses: 0,
  });

  // Initialize stats when template is selected
  useEffect(() => {
    if (state.selectedTemplate) {
      const initialStats: ShardStats = {};
      state.selectedTemplate!.map.targets.forEach((target) => {
        initialStats[target.key] = { count: 0, percentage: 0 };
      });
      setState((prev) => ({ ...prev, stats: initialStats }));
    }
  }, [state.selectedTemplate]);

  // Event generator
  useEffect(() => {
    if (!state.isRunning || !state.selectedTemplate) return;

    const interval = setInterval(() => {
      // Generate random ID
      const id = Math.floor(Math.random() * 1000000);
      const result = crushLocate(id, state.selectedTemplate!.map);
      const shard = result.primaries[0] || "unknown";

      const access: ShardAccess = {
        id,
        pg: result.pg,
        shard,
        timestamp: Date.now(),
      };

      setState((prev) => {
        const newAccesses = [...prev.accesses, access].slice(-100); // Keep last 100
        const newTotal = prev.totalAccesses + 1;

        // Update stats
        const newStats = { ...prev.stats };
        if (newStats[shard]) {
          newStats[shard].count++;
          newStats[shard].lastAccess = Date.now();
        }

        // Calculate percentages
        Object.keys(newStats).forEach((key) => {
          newStats[key].percentage = (newStats[key].count / newTotal) * 100;
        });

        return {
          ...prev,
          accesses: newAccesses,
          stats: newStats,
          totalAccesses: newTotal,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isRunning, state.selectedTemplate]);

  const handleTemplateSelect = (index: number) => {
    if (index === -1 && selectedIndex >= 0 && selectedIndex < CRUSH_TEMPLATES.length) {
      // Selection confirmed
      setState({
        selectedTemplate: CRUSH_TEMPLATES[selectedIndex],
        isRunning: true,
        accesses: [],
        stats: {},
        totalAccesses: 0,
      });
    } else if (index >= 0) {
      setSelectedIndex(index);
    }
  };

  const toggleRunning = () => {
    setState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  };

  if (!state.selectedTemplate) {
    return (
      <Box padding={1}>
        <TemplateSelector templates={CRUSH_TEMPLATES} selectedIndex={selectedIndex} onSelect={handleTemplateSelect} />
      </Box>
    );
  }

  const tpl = state.selectedTemplate!;
  const currentAccess = state.accesses[state.accesses.length - 1];

  return (
    <Box padding={1} flexDirection="column">
      <MapInfo template={tpl} />

      <Box marginTop={2} flexDirection="row" gap={4}>
        <Box flexDirection="column" width="60%">
          <ShardVisualizer stats={state.stats} totalAccesses={state.totalAccesses} currentAccess={currentAccess} />
        </Box>

        <Box flexDirection="column" width="40%">
          <AccessLog accesses={state.accesses} />
        </Box>
      </Box>

      <Controls isRunning={state.isRunning} onToggle={toggleRunning} />
    </Box>
  );
}

// Run the CLI
render(<App />);
