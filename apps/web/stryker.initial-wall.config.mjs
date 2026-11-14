// Focused mutation scope for AD-21's detached initial materialization route.
// It runs in place: do not edit the selected source file while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/domain/materialize-initial-wall-segment.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/initial-wall-materialization-mutation.json'
  },
  mutate: ['src/domain/materialize-initial-wall-segment.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  // This floor prevents a silent regression in the focused harness. It is not
  // a substitute for reviewing high-risk survivors under quality-strategy §6.2.
  thresholds: {
    break: 70,
    high: 80,
    low: 70
  }
};
