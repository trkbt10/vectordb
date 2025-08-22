/**
 * @file Route builder utilities
 */
import type { Route } from "./types";

/**
 * Create a route configuration
 */
export function createRoute<T extends Record<string, unknown>>(
  path: string,
  component: React.ComponentType<T>,
  props?: T,
): Route {
  return { path, component: component as React.ComponentType<Record<string, unknown>>, props };
}

/**
 * Create nested routes with a base path
 */
export function createNestedRoutes(basePath: string, routes: Route[]): Route[] {
  return routes.map((route) => ({
    ...route,
    path: `${basePath}${route.path}`,
  }));
}

/**
 * Route path utilities
 */
export const RoutePath = {
  join: (...parts: string[]) => {
    return parts
      .map((part) => part.replace(/^\/|\/$/g, ""))
      .filter(Boolean)
      .join("/");
  },

  parent: (path: string) => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) {
      return "/";
    }
    return "/" + parts.slice(0, -1).join("/");
  },

  basename: (path: string) => {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  },
};
