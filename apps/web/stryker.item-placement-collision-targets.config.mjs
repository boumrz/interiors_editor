// Focused mutation evidence for semantic collision targets shown by the item
// ghost. It mutates in place; do not edit the selected module while it runs.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/domain/parametric-item.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/item-placement-collision-targets-mutation.json'
  },
  mutate: ['src/domain/parametric-item.ts:176-201'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 80,
    high: 80,
    low: 70
  }
};
