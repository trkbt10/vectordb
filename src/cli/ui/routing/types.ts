/**
 * @file Routing types and interfaces
 */

export type Route = {
  path: string;
  component: React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
};

export type NavigationState = {
  currentPath: string;
  history: string[];
};

export type NavigationContextValue = {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
  canGoBack: boolean;
};
