/**
 * @file CORS mounting
 */
import type { Hono } from "hono";
import { cors as honoCors } from "hono/cors";
import type { CorsOptions } from "./types";

/**
 * Mount CORS middleware according to config. Pass `true` to allow all,
 * or a Hono CORS options object for fine-grained control. Omit to disable.
 */
export function applyCors(app: Hono, cors?: CorsOptions) {
  if (!cors) {
    return;
  } // disabled
  if (cors === true) {
    app.use("*", honoCors());
    return;
  }
  app.use("*", honoCors(cors as Parameters<typeof honoCors>[0]));
}
