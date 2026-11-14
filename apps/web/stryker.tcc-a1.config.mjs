// Focused mutation scope for detached TCC-A1 corpus execution.
// It runs in place: do not edit the selected source files while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/domain/tcc-a1-corpus-runner.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/tcc-a1-mutation.json'
  },
  mutate: [
    'src/domain/tcc-a1-corpus-runner.ts',
    'src/domain/initial-wall-materialization-tcc-a1-corpus.ts'
  ],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command'
};
