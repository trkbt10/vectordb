/**
 * @file Tests for Route utilities
 */
import React from "react";
import { createRoute, createNestedRoutes, RoutePath } from "./Route";
import { Text } from "ink";

describe("Route utilities", () => {
  describe("createRoute", () => {
    test("creates a route with path and component", () => {
      const TestComponent = () => <Text>Test</Text>;
      const route = createRoute("/test", TestComponent);

      expect(route.path).toBe("/test");
      expect(route.component).toBe(TestComponent);
      expect(route.props).toBeUndefined();
    });

    test("creates a route with props", () => {
      const TestComponent = ({ message }: { message: string }) => <Text>{message}</Text>;
      const route = createRoute("/test", TestComponent, { message: "Hello" });

      expect(route.path).toBe("/test");
      expect(route.component).toBe(TestComponent);
      expect(route.props).toEqual({ message: "Hello" });
    });

    test("handles complex props", () => {
      type Props = { count: number; items: string[]; enabled: boolean };
      const TestComponent = ({ count, items, enabled }: Props) => (
        <Text>{`${count} ${items.join(",")} ${enabled}`}</Text>
      );
      
      const route = createRoute("/complex", TestComponent, {
        count: 5,
        items: ["a", "b", "c"],
        enabled: true,
      });

      expect(route.props).toEqual({
        count: 5,
        items: ["a", "b", "c"],
        enabled: true,
      });
    });
  });

  describe("createNestedRoutes", () => {
    test("prepends base path to routes", () => {
      const TestComponent = () => <Text>Test</Text>;
      const routes = [
        createRoute("/home", TestComponent),
        createRoute("/settings", TestComponent),
        createRoute("/profile", TestComponent),
      ];

      const nested = createNestedRoutes("/app", routes);

      expect(nested[0].path).toBe("/app/home");
      expect(nested[1].path).toBe("/app/settings");
      expect(nested[2].path).toBe("/app/profile");
    });

    test("preserves component and props", () => {
      const TestComponent = ({ id }: { id: number }) => <Text>{id}</Text>;
      const routes = [
        createRoute("/item", TestComponent, { id: 1 }),
      ];

      const nested = createNestedRoutes("/catalog", routes);

      expect(nested[0].path).toBe("/catalog/item");
      expect(nested[0].component).toBe(TestComponent);
      expect(nested[0].props).toEqual({ id: 1 });
    });

    test("handles empty base path", () => {
      const TestComponent = () => <Text>Test</Text>;
      const routes = [createRoute("/test", TestComponent)];

      const nested = createNestedRoutes("", routes);

      expect(nested[0].path).toBe("/test");
    });
  });

  describe("RoutePath utilities", () => {
    describe("join", () => {
      test("joins path parts", () => {
        expect(RoutePath.join("a", "b", "c")).toBe("a/b/c");
      });

      test("removes leading and trailing slashes", () => {
        expect(RoutePath.join("/a/", "/b/", "/c/")).toBe("a/b/c");
      });

      test("handles empty parts", () => {
        expect(RoutePath.join("a", "", "b")).toBe("a/b");
      });

      test("handles single part", () => {
        expect(RoutePath.join("single")).toBe("single");
      });

      test("handles no parts", () => {
        expect(RoutePath.join()).toBe("");
      });
    });

    describe("parent", () => {
      test("returns parent path", () => {
        expect(RoutePath.parent("/app/settings/general")).toBe("/app/settings");
      });

      test("returns root for top-level path", () => {
        expect(RoutePath.parent("/app")).toBe("/");
      });

      test("returns root for root path", () => {
        expect(RoutePath.parent("/")).toBe("/");
      });

      test("handles paths without leading slash", () => {
        expect(RoutePath.parent("app/settings")).toBe("/app");
      });
    });

    describe("basename", () => {
      test("returns last part of path", () => {
        expect(RoutePath.basename("/app/settings/general")).toBe("general");
      });

      test("returns path for single segment", () => {
        expect(RoutePath.basename("/app")).toBe("app");
      });

      test("returns empty for root", () => {
        expect(RoutePath.basename("/")).toBe("");
      });

      test("handles paths without leading slash", () => {
        expect(RoutePath.basename("app/settings")).toBe("settings");
      });
    });
  });
});