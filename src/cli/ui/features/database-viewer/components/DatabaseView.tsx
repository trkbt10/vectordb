/**
 * @file Database view: open filesystem-backed database and perform actions
 */
import React, { Suspense } from "react";
import { DatabaseExplorer } from "./DatabaseExplorer";
import type { FlowSchema } from "../../database-wizard/components/FlowWizard";
import { defaultConfigFlow } from "../../database-wizard/components/flows/defaultConfigFlow";
import { getConfigLoad, type LoadState, configPatternsLabel } from "../../../../../config";
import { configPatternsLabel } from "../../../../../config";
import { Box, Text } from "ink";

/**
 * DatabaseView
 * Why: single entry to open a filesystem-backed database and route to DB tools.
 */
/**
 * DatabaseView entry component.
 * Accepts an optional onExit handler from router, currently unused by the Explorer.
 */
function ExplorerWithConfig({
  onExit,
  configPath,
  flow,
  loader,
}: {
  onExit: () => void;
  configPath?: string;
  flow: FlowSchema;
  loader: ReturnType<typeof getConfigLoad>;
}) {
  const resolved = configPath ?? loader.resource.read();
  const direct = resolved ?? undefined;
  return <DatabaseExplorer configFlow={flow} directConfigPath={direct} onExit={onExit} />;
}

/**
 * DatabaseView: Suspense-driven config open and explorer mount.
 * @param onExit - Callback to navigate back from the database view.
 * @param configPath - Optional explicit config module path; if absent, discovered via loader.
 * @returns JSX Element rendering the explorer (with Suspense fallback while resolving config).
 */
export function DatabaseView({ onExit, configPath }: { onExit: () => void; configPath?: string }) {
  // reference prop to satisfy no-unused-vars until used by explorer shell
  void onExit;
  // Provide a minimal built-in flow so wizard is available even if caller doesn't inject one.
  const defaultFlow: FlowSchema = defaultConfigFlow;
  const loader = React.useMemo(() => getConfigLoad(), []);
  function Fallback() {
    const [info, setInfo] = React.useState<LoadState>(loader.getState());
    React.useEffect(() => {
      return loader.subscribe((s) => setInfo(s));
    }, []);
    return (
      <Box flexDirection="column">
        <Text color="gray">Opening configuration...</Text>
        <Text color="gray">• cwd: {process.cwd()}</Text>
        <Text color="gray">
          • trying: {info.current ?? "(pending)"} · phase: {info.phase}
        </Text>
        <Text color="gray">
          • tried: {info.tried.length} · found: {info.found ?? "(none)"}
        </Text>
        {info.error && <Text color="red">• error: {info.error}</Text>}
        <Text color="gray">• patterns: {configPatternsLabel()}</Text>
        <Text color="gray">• tip: if none found, the Wizard will start automatically</Text>
      </Box>
    );
  }
  return (
    <Suspense fallback={<Fallback />}>
      <ExplorerWithConfig onExit={onExit} configPath={configPath} flow={defaultFlow} loader={loader} />
    </Suspense>
  );
}
