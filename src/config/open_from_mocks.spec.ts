/**
 * @file Use configs from __mocks__/config to open clients
 */
import path from "node:path";
import { openClientFromConfig } from "./index";

describe("open from __mocks__/config", () => {
  it("opens client from mem URI config (.mjs)", async () => {
    const p = path.resolve("__mocks__/config/vectordb.config.mjs");
    const client = await openClientFromConfig(p);
    expect(client).toBeTruthy();
    await client.push({ id: 1, vector: new Float32Array([1, 0]) });
    const res = await client.findMany(new Float32Array([1, 0]), { k: 1 });
    expect(res[0]?.id).toBe(1);
  });

  it("opens client from explicit FileIO (.cjs)", async () => {
    const p = path.resolve("__mocks__/config/vectordb.config.cjs");
    const client = await openClientFromConfig(p);
    expect(client).toBeTruthy();
    await client.push({ id: 2, vector: new Float32Array([0, 1]) });
    const res = await client.findMany(new Float32Array([0, 1]), { k: 1 });
    expect(res[0]?.id).toBe(2);
  });
});
