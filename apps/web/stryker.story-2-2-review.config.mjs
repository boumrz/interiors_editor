// Focused mutation evidence for the Story 2.2 review fixes: scale-stable
// magnetic targets, exact constrained contacts and failure-safe topology IDs.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/ui/wall-draft.test.tsx src/domain/add-wall-segment.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/story-2-2-review-mutation.json'
  },
  mutate: [
    'src/ui/wall-draft.ts:59-84',
    'src/ui/wall-draft.ts:202-330',
    'src/ui/wall-draft.ts:392-560',
    'src/domain/add-wall-segment.ts:100-167',
    'src/domain/add-wall-segment.ts:264-375',
    'src/domain/add-wall-segment.ts:485-557'
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
