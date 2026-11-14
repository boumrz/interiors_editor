// Rstest remains the sole test framework for this production mutation scope.
export default {
  commandRunner: {
    command:
      'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  // Stryker 9.6.1 cannot preprocess a TypeScript 7 sandbox; it restores this
  // scoped backup automatically. Run this command without concurrent source edits.
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/production-mutation.json'
  },
  mutate: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx'
  ],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command'
};
