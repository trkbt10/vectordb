/**
 * @file Unit tests for pure route matching logic
 */
import React from "react";
import { Text } from "ink";
import { matchRoute } from "./Router";
import type { Route } from "./types";

const C = () => <Text>ok</Text>;

describe("matchRoute", () => {
  const routes: Route[] = [
    { path: "/", component: C },
    { path: "/home", component: C },
    { path: "/settings", component: C },
    { path: "/db", component: C },
    { path: "/db/view", component: C },
    { path: "/wild/*", component: C },
  ];

  test("matches exact path first", () => {
    const r = matchRoute("/home", routes);
    expect(r?.path).toBe("/home");
  });

  test("matches nested prefix when exact missing", () => {
    const r = matchRoute("/db/view/123", routes);
    expect(r?.path).toBe("/db/view");
  });

  test("matches wildcard when pattern fits", () => {
    const r = matchRoute("/wild/anything/here", routes);
    expect(r?.path).toBe("/wild/*");
  });

  test("returns null for no match", () => {
    const r = matchRoute("/unknown/path", routes);
    expect(r).toBeNull();
  });
});

