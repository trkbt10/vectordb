/**
 * @file Database menu component for selecting actions
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ClusterCtx } from "./types";
import { StatsView } from "./views/StatsView";
import { ListView } from "./views/ListView";
import { SearchView } from "./views/SearchView";
import { FilterView } from "./views/FilterView";
import { RebuildView } from "./views/RebuildView";
import { UpsertView } from "./views/UpsertView";
import { DeleteView } from "./views/DeleteView";
import { NavigationProvider, Router, createRoute, useNavigation } from "../routing";

type ClusterMenuProps = { ctx: ClusterCtx; onExit: () => void };
type Choice = { label: string; value: string };

/**
 * ClusterMenu
 * Why: hub to database utilities (stats, list, search, edit, rebuild).
 */
export function ClusterMenu({ ctx, onExit }: ClusterMenuProps) {
  return (
    <NavigationProvider initialPath="/menu">
      <ClusterMenuRouter ctx={ctx} onExit={onExit} />
    </NavigationProvider>
  );
}

function ClusterMenuRouter({ ctx, onExit }: ClusterMenuProps) {
  const routes = useMemo(
    () => [
      createRoute("/menu", MenuView, { ctx, onExit }),
      createRoute("/stats", StatsView, { ctx, onBack: () => {} }),
      createRoute("/list", ListView, { ctx, onBack: () => {} }),
      createRoute("/search", SearchView, { ctx, onBack: () => {} }),
      createRoute("/filter", FilterView, { ctx, onBack: () => {} }),
      createRoute("/upsert", UpsertView, { ctx, onBack: () => {} }),
      createRoute("/delete", DeleteView, { ctx, onBack: () => {} }),
      createRoute("/rebuild", RebuildView, { ctx, onBack: () => {} }),
    ],
    [ctx, onExit],
  );

  const routesWithNavigation = useMemo(() => {
    return routes.map((route) => {
      if (route.path === "/menu") return route;
      return {
        ...route,
        component: withNavigation(route.component as React.ComponentType<{ onBack: () => void } & Record<string, unknown>>),
      };
    });
  }, [routes]);

  return <Router routes={routesWithNavigation} />;
}

function withNavigation<T extends { onBack: () => void }>(
  Component: React.ComponentType<T>,
): React.ComponentType<Omit<T, "onBack">> {
  return function NavigationWrapper(props: Omit<T, "onBack">) {
    const { goBack } = useNavigation();
    return <Component {...(props as T)} onBack={goBack} />;
  };
}

function MenuView({ ctx, onExit }: ClusterMenuProps) {
  const { navigate } = useNavigation();
  const items: Choice[] = useMemo(
    () => [
      { label: "Stats / Diagnose", value: "/stats" },
      { label: "List Items", value: "/list" },
      { label: "Search", value: "/search" },
      { label: "Filter (meta eq)", value: "/filter" },
      { label: "Add/Update Row", value: "/upsert" },
      { label: "Delete Row", value: "/delete" },
      { label: "Rebuild State", value: "/rebuild" },
      { label: "Back", value: "back" },
    ],
    [],
  );
  return (
    <Box flexDirection="column">
      <Text color="cyan">Database: {ctx.name}</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(i: Choice) => {
            if (i.value === "back") return onExit();
            navigate(i.value);
          }}
        />
      </Box>
    </Box>
  );
}
