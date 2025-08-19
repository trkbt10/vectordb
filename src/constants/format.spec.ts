/**
 * @file Unit tests for format constants
 *
 * Ensures metric/strategy mappers are bijective and exhaustive.
 */
import { encodeMetric, decodeMetric, encodeStrategy, decodeStrategy, METRIC_CODES, STRATEGY_CODES } from "./format";

describe("vectorlite/format", () => {
  it("metric encode/decode roundtrip", () => {
    for (const code of Object.values(METRIC_CODES)) {
      const m = decodeMetric(code);
      expect(encodeMetric(m)).toBe(code);
    }
  });

  it("strategy encode/decode roundtrip", () => {
    for (const code of Object.values(STRATEGY_CODES)) {
      const s = decodeStrategy(code);
      expect(encodeStrategy(s)).toBe(code);
    }
  });
});
