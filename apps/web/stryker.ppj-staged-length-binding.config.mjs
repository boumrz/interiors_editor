// Narrow mutation evidence for the exact parent-size check before digest/AST.
// It runs in place: do not edit the selected source module while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/adapters/portable-backup/ppj-a1-staged-project-member.test.ts src/adapters/portable-backup/ppj-a1-canonical-project-member-ingress.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/ppj-staged-length-binding-mutation.json'
  },
  mutate: [
    'src/adapters/portable-backup/ppj-a1-staged-project-member.ts:88-93',
    'src/adapters/portable-backup/ppj-a1-staged-project-member.ts:154-156'
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
