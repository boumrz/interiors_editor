// Focused mutation evidence for the fail-closed portable-backup envelope.
// It mutates in place; do not edit the selected module while it runs.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/application/export-portable-backup.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/portable-backup-export-mutation.json'
  },
  mutate: [
    'src/application/export-portable-backup.ts:57-58',
    'src/application/export-portable-backup.ts:72-111',
    'src/application/export-portable-backup.ts:120-153'
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
