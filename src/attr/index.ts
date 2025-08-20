/**
 * @file Attribute indexing system for efficient metadata filtering
 *
 * This module provides a flexible attribute indexing system that enables fast
 * pre-filtering of vectors based on metadata constraints. Key features:
 * - Support for equality, existence, and range queries on attributes
 * - Pluggable backend strategies (basic, bitmap) for different use cases
 * - Integration with filter expressions for query optimization
 * - Type-safe attribute operations with proper null handling
 *
 * The attribute index allows VectorDB to efficiently combine vector similarity
 * search with traditional database-style filtering, dramatically reducing the
 * search space before expensive similarity calculations. This is crucial for
 * real-world applications where vectors have associated metadata (tags, timestamps,
 * categories, etc.) that users want to filter by.
 */
import type { Range, Scalar } from "./filter/expr";
import { createBasicIndex } from "./strategies/basic";
import { createBitmapIndex } from "./strategies/bitmap";

// Core types
export type AttrValue = string | number | boolean | (string | number)[] | null;
export type Attrs = Record<string, AttrValue>;

/**
 * Unified interface for attribute indexing strategies.
 * All strategies must implement these methods for consistent behavior.
 */
export type AttrIndex = {
  /** Identifies the strategy being used */
  strategy: string;
  /** Replace all attributes for an id (removes previous attributes) */
  setAttrs(id: number, attrs: Attrs | null): void;
  /** Get attributes for an id (returns null if not found) */
  getAttrs(id: number): Attrs | null;
  /** Remove all attributes for an id */
  removeId(id: number): void;
  /** Find ids where key equals value */
  eq(key: string, value: Scalar): Set<number> | null;
  /** Find ids where key exists (is not null/undefined) */
  exists(key: string): Set<number> | null;
  /** Find ids where numeric key falls within range */
  range(key: string, r: Range): Set<number> | null;
};

/**
 * Create an attribute index instance with a given strategy.
 *
 * @param strategy - The indexing strategy to use:
 *   - "basic": In-memory hash maps, suitable for small to medium datasets
 *   - "bitmap": Bitmap-based indexing for memory-efficient operations
 * @returns An AttrIndex instance implementing the chosen strategy
 */
export function createAttrIndex(strategy: "basic" | "bitmap" = "basic"): AttrIndex {
  switch (strategy) {
    case "bitmap":
      return createBitmapIndex();
    case "basic":
      return createBasicIndex();
    default:
      throw new Error(`Unsupported attribute index strategy: ${String(strategy)}. Use 'basic' | 'bitmap'.`);
  }
}
