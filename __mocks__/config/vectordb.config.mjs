/**
 * @file Memory-backed config for tests
 */
export default {
  name: 'mock-mem',
  database: { dim: 2 },
  storage: { index: 'mem:', data: 'mem:' },
};
