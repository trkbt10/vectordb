/**
 * @file Database registry types
 */

export type DatabaseRegistryEntry = {
  name: string;
  configPath: string;
  description?: string;
};

export type DatabaseRegistry = {
  entries: DatabaseRegistryEntry[];
};
