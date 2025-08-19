/**
 * @file Binary serialization format definitions and codecs
 *
 * This module defines the binary format specification for VectorLite persistence,
 * ensuring consistent and type-safe serialization across versions. Features:
 * - Magic number (VLIT) for file format identification
 * - Version number for forward compatibility
 * - Type-safe enum codecs for metrics and strategies
 * - Centralized format constants to prevent inconsistencies
 *
 * The format design prioritizes both space efficiency and type safety,
 * using numeric codes for enums while maintaining compile-time guarantees
 * through exhaustive TypeScript switches.
 */
import type { Metric, VectorStoreState } from "../types";
import { createEnumCodec } from "../util/enum_codec";

export const MAGIC = 0x564c4954; // 'VLIT'
export const VERSION = 1;

type Strategy = VectorStoreState<unknown>["strategy"];

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
