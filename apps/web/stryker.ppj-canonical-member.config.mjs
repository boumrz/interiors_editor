// Narrow mutation evidence for the raw archive-name → canonical Project member handoff.
// It runs in place: do not edit the selected source module while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/adapters/portable-backup/ppj-a1-canonical-project-member-ingress.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/ppj-canonical-member-mutation.json'
  },
  mutate: ['src/adapters/portable-backup/ppj-a1-canonical-project-member-ingress.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 70,
    high: 80,
    low: 70
  }
};
