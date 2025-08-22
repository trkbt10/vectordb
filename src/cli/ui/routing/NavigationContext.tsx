/**
 * @file Navigation context for routing
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { NavigationContextValue, NavigationState } from "./types";

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

type NavigationProviderProps = {
  children: React.ReactNode;
  initialPath?: string;
};

/**
 * Navigation provider component
 */
export function NavigationProvider({ children, initialPath = "/" }: NavigationProviderProps) {
  const [state, setState] = useState<NavigationState>({
    currentPath: initialPath,
    history: [initialPath],
  });

  const navigate = useCallback((path: string) => {
    setState((prev) => ({
      currentPath: path,
      history: [...prev.history, path],
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length <= 1) {
        return prev;
      }
      const newHistory = prev.history.slice(0, -1);
      return {
        currentPath: newHistory[newHistory.length - 1],
        history: newHistory,
      };
    });
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      currentPath: state.currentPath,
      navigate,
      goBack,
      canGoBack: state.history.length > 1,
    }),
    [state.currentPath, state.history.length, navigate, goBack],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

/**
 * Hook to use navigation context
 */
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }

  return context;
}
