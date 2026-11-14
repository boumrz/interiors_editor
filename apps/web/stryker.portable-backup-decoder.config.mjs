// Focused mutation evidence for the current resource-free archive boundary.
// It mutates in place; do not edit the selected module while it runs.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/adapters/portable-backup/fflate-portable-backup-decoder.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/portable-backup-decoder-mutation.json'
  },
  mutate: [
    'src/adapters/portable-backup/fflate-portable-backup-decoder.ts:62-193',
    'src/adapters/portable-backup/fflate-portable-backup-decoder.ts:256-299',
    'src/adapters/portable-backup/fflate-portable-backup-decoder.ts:447-488'
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
