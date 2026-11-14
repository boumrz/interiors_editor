// Focused mutation evidence for advisory browser storage-pressure policy.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      [
        './node_modules/.bin/rstest run --config rstest.config.mjs',
        'src/application/storage-pressure.test.ts',
        'src/app/project-controller.test.ts'
      ].join(' ')
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/storage-pressure-mutation.json'
  },
  mutate: ['src/application/storage-pressure.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 80,
    high: 80,
    low: 70
  }
};
