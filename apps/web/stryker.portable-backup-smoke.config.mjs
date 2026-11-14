// Focused mutation evidence for the prepublication local read/render smoke.
// It mutates in place; do not edit the selected module while it runs.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/adapters/portable-backup/portable-backup-read-render-smoke.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/portable-backup-smoke-mutation.json'
  },
  mutate: ['src/adapters/portable-backup/portable-backup-read-render-smoke.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 80,
    high: 80,
    low: 70
  }
};
