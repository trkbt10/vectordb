/**
 * @file CrushMap template configurations
 */

import type { CrushTemplate } from "./crush-cli-types";

export const CRUSH_TEMPLATES: CrushTemplate[] = [
  {
    name: "Simple 2-Shard",
    description: "Basic configuration with 2 shards, 8 PGs",
    map: {
      pgs: 8,
      replicas: 1,
      targets: [
        { key: "shard-A", weight: 1.0 },
        { key: "shard-B", weight: 1.0 },
      ],
    },
  },
  {
    name: "4-Shard Balanced",
    description: "4 shards with equal weight, 16 PGs",
    map: {
      pgs: 16,
      replicas: 1,
      targets: [
        { key: "shard-1", weight: 1.0 },
        { key: "shard-2", weight: 1.0 },
        { key: "shard-3", weight: 1.0 },
        { key: "shard-4", weight: 1.0 },
      ],
    },
  },
  {
    name: "Weighted Distribution",
    description: "3 shards with different weights (2:1:1)",
    map: {
      pgs: 32,
      replicas: 1,
      targets: [
        { key: "large-shard", weight: 2.0 },
        { key: "medium-shard", weight: 1.0 },
        { key: "small-shard", weight: 1.0 },
      ],
    },
  },
  {
    name: "Multi-Zone Setup",
    description: "6 shards across 3 zones, 64 PGs",
    map: {
      pgs: 64,
      replicas: 1,
      targets: [
        { key: "zone-a-1", weight: 1.0, zone: "zone-a" },
        { key: "zone-a-2", weight: 1.0, zone: "zone-a" },
        { key: "zone-b-1", weight: 1.0, zone: "zone-b" },
        { key: "zone-b-2", weight: 1.0, zone: "zone-b" },
        { key: "zone-c-1", weight: 1.0, zone: "zone-c" },
        { key: "zone-c-2", weight: 1.0, zone: "zone-c" },
      ],
    },
  },
  {
    name: "Large Scale",
    description: "10 shards with 128 PGs for high throughput",
    map: {
      pgs: 128,
      replicas: 1,
      targets: Array.from({ length: 10 }, (_, i) => ({
        key: `shard-${String.fromCharCode(65 + i)}`,
        weight: 1.0,
      })),
    },
  },
  {
    name: "Replica Setup",
    description: "3 shards with 2 replicas each",
    map: {
      pgs: 16,
      replicas: 2,
      targets: [
        { key: "primary-1", weight: 1.0 },
        { key: "primary-2", weight: 1.0 },
        { key: "primary-3", weight: 1.0 },
      ],
    },
  },
];
