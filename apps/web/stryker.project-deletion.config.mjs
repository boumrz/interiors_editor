// Focused mutation evidence for confirmed direct Project deletion.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      [
        './node_modules/.bin/rstest run --config rstest.config.mjs',
        'src/adapters/persistence/durable-project-repository.test.ts',
        'src/adapters/persistence/indexeddb-versioned-project-store.test.ts',
        'src/app/project-controller.test.ts'
      ].join(' ')
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/project-deletion-mutation.json'
  },
  mutate: [
    'src/adapters/persistence/durable-project-repository.ts:162-194',
    'src/adapters/persistence/indexeddb-versioned-project-store.ts:346-400',
    'src/app/project-controller.ts:888-910'
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
