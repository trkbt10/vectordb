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
import { Settings } from "./features/settings/components/Settings";

/**
 * Root application component that wires NavigationProvider and routes.
 */
export function App() {
  return (
    <NavigationProvider initialPath="/home">
      <AppWithRoutes />
    </NavigationProvider>
  );
}

/**
 * Internal component providing route definitions and global shortcuts.
 */
function AppWithRoutes() {
  const { navigate, goBack } = useNavigation();
  useInput((input, key) => {
    if (key.ctrl && input === "c") return; // allow default exit
    if (input === "q") process.exit(0);
    if (input === "h") navigate("/home");
    if (input === "b") goBack();
    if (input === "?") navigate("/help");
  });

  const routes = [
    createRoute("/home", Home, {}),
    createRoute("/database", DatabaseView as React.ComponentType, { onExit: () => navigate("/home") }),
    createRoute("/wizard", DefaultWizard, { onDone: () => navigate("/database") }),
    createRoute("/help", Help, { onBack: () => goBack() }),
    createRoute("/settings", Settings, { onBack: () => goBack() }),
  ];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="magentaBright">VectorDB CLI</Text>
      </Box>
      <Text color="gray">────────────────────────────────────────────────────────</Text>
      <Router routes={routes} />
      <Text color="gray">────────────────────────────────────────────────────────</Text>
      <Text color="gray">Shortcuts: h=Home  b=Back  ?=Help  q=Quit</Text>
    </Box>
  );
}
