/**
 * @file Root CLI app (router + global shortcuts)
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import { NavigationProvider, Router, createRoute, useNavigation } from "./routing";
import { Home } from "./features/home/components/Home";
import { DatabaseView } from "./features/database-viewer/components/DatabaseView";
import { DefaultWizard } from "./features/database-wizard/components/DefaultWizard";
import { Help } from "./features/help/components/Help";
import { existsSync } from "node:fs";
import path from "node:path";
import { FooterContext } from "./FooterContext";

/**
 * Root application component that wires NavigationProvider and routes.
 */
export function App({ initialConfigPath }: { initialConfigPath?: string }) {
  return (
    <NavigationProvider initialPath="/home">
      <AppWithRoutes initialConfigPath={initialConfigPath} />
    </NavigationProvider>
  );
}

/**
 * Internal component providing route definitions and global shortcuts.
 */
function AppWithRoutes({ initialConfigPath }: { initialConfigPath?: string }) {
  const cols = process.stdout?.columns ? Math.max(40, process.stdout.columns) : 80;
  const rows = process.stdout?.rows ? Math.max(12, process.stdout.rows) : 24;
  const { navigate, goBack } = useNavigation();
  const [footer, setFooter] = React.useState<React.ReactNode | null>(null);
  useInput((input, key) => {
    if (key.ctrl && input === "c") return; // allow default exit
    // Disable global shortcuts to avoid stealing focus from inputs
  });

  const routes = [
    createRoute("/home", Home, {}),
    createRoute("/database", DatabaseView as React.ComponentType, { onExit: () => navigate("/home"), configPath: initialConfigPath }),
    createRoute("/wizard", DefaultWizard, { onDone: () => navigate("/database") }),
    createRoute("/help", Help, { onBack: () => goBack() }),
  ];

  React.useEffect(() => {
    if (initialConfigPath) {
      navigate("/database");
      return;
    }
    const p = path.resolve("vectordb.config.json");
    const dest = existsSync(p) ? "/database" : "/wizard";
    navigate(dest);
  }, []);

  return (
    <FooterContext.Provider value={{ footer, setFooter }}>
      
      <Box flexDirection="column" width={cols} height={rows}>
        <Box>
          <Text color="magentaBright">VectorDB CLI</Text>
        </Box>
        <Text color="gray">{"─".repeat(Math.max(8, cols - 2))}</Text>
        <Box flexGrow={1} alignItems="stretch" justifyContent="flex-start">
          <Router routes={routes} />
        </Box>
        <Text color="gray">{"─".repeat(Math.max(8, cols - 2))}</Text>
        <Box>{footer ?? null}</Box>
      </Box>
              </FooterContext.Provider>
  );
}
