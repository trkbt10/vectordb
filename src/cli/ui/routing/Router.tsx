/**
 * @file Router component for path-based routing
 */
import React, { useMemo } from "react";
import { useNavigation } from "./NavigationContext";
import type { Route } from "./types";

type RouterProps = {
  routes: Route[];
  fallback?: React.ReactNode;
};

/**
 * Router component that renders components based on current path
 */
export function Router({ routes, fallback }: RouterProps) {
  const { currentPath } = useNavigation();

  const matchedRoute = useMemo(() => matchRoute(currentPath, routes), [currentPath, routes]);

  if (!matchedRoute) {
    return <>{fallback || <NotFound />}</>;
  }

  const { component: Component, props = {} } = matchedRoute;
  return <Component {...props} />;
}

/**
 * Default not found component
 */
function NotFound() {
  return <Text color="red">Route not found: {useNavigation().currentPath}</Text>;
}

// Re-export Text from ink to avoid missing import
import { Text } from "ink";

/**
 * Pure route matching for testing and reuse.
 */
export function matchRoute(currentPath: string, routes: Route[]): Route | null {
  // First try exact match
  const exactMatch = routes.find((r) => r.path === currentPath);
  if (exactMatch) return exactMatch;

  // Then try prefix match for nested routes (prefer longest path)
  const prefixMatches = routes.filter((r) => currentPath.startsWith(r.path + "/"));
  if (prefixMatches.length) {
    prefixMatches.sort((a, b) => b.path.length - a.path.length);
    return prefixMatches[0] || null;
  }

  // Finally try wildcard routes
  const wildcardMatch = routes.find((r) => r.path.includes("*"));
  if (wildcardMatch) {
    const pathPattern = wildcardMatch.path.replace("*", "(.*)");
    const regex = new RegExp(`^${pathPattern}$`);
    if (regex.test(currentPath)) return wildcardMatch;
  }

  return null;
}
