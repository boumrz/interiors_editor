// Narrow mutation evidence for bounded ZIP central-directory indexing and entry leases.
// It runs in place: do not edit the selected source module while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/adapters/portable-backup/ppj-a1-zip-central-directory.test.ts'
  },
  concurrency: 4,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/ppj-zip-central-directory-mutation.json'
  },
  mutate: ['src/adapters/portable-backup/ppj-a1-zip-central-directory.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 70,
    high: 80,
    low: 70
  }
};
