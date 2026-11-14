// Focused mutation scope for S2-02a's detached PPJ-A1 byte boundary.
// It runs in place: do not edit either selected source module while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/domain/ppj-a1-lossless-json.test.ts src/adapters/portable-backup/ppj-a1-staged-project-member.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/s2-02a-mutation.json'
  },
  mutate: [
    'src/domain/ppj-a1-lossless-json.ts',
    'src/adapters/portable-backup/ppj-a1-staged-project-member.ts'
  ],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 70,
    high: 80,
    low: 70
  }
};
