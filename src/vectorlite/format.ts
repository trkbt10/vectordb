/**
 * Binary format constants and type-safe mappers.
 *
 * Why: Centralize MAGIC/VERSION and (de)coders for metric/strategy so changes
 * are enforced by the type system (exhaustive switches) and propagate safely.
 */
import type { Metric } from "../types";
import type { VectorLiteState } from "../types";
import { createEnumCodec } from "../util/enum_codec";

export const MAGIC = 0x564c4954; // 'VLIT'
export const VERSION = 1;

type Strategy = VectorLiteState<unknown>["strategy"];

// enum codec helpers are provided by ../util/enum_codec

// Single source of truth for codes
const metricCodec = createEnumCodec<Metric>({
  cosine: 0,
  l2: 1,
  dot: 2,
} as const satisfies Record<Metric, number>);
export const METRIC_CODES = metricCodec.codes;

const strategyCodec = createEnumCodec<Strategy>({
  bruteforce: 0,
  hnsw: 1,
  ivf: 2,
} as const satisfies Record<Strategy, number>);
export const STRATEGY_CODES = strategyCodec.codes;

/** 0=cosine, 1=l2, 2=dot */
export function encodeMetric(metric: Metric): number {
  return metricCodec.encode(metric);
}

/**
 *
 */
export function decodeMetric(code: number): Metric {
  return metricCodec.decode(code);
}

/** 0=bruteforce, 1=hnsw, 2=ivf */
export function encodeStrategy(s: Strategy): number {
  return strategyCodec.encode(s);
}

/**
 *
 */
export function decodeStrategy(code: number): Strategy {
  return strategyCodec.decode(code);
}
