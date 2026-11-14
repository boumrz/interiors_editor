// The command runner keeps Rstest as the sole test framework for this POC.
export default {
  commandRunner: {
    command:
      'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/poc/editor-state.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json'
  },
  mutate: ['src/poc/editor-state.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command'
};
