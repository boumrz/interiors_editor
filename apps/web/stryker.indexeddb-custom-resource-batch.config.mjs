// Focused mutation evidence for one-transaction IndexedDB batch replacement.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/adapters/persistence/indexeddb-custom-asset-resource-store.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/indexeddb-custom-resource-batch-mutation.json'
  },
  mutate: [
    'src/adapters/persistence/indexeddb-custom-asset-resource-store.ts:94-107'
  ],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 80,
    high: 80,
    low: 70
  }
};
