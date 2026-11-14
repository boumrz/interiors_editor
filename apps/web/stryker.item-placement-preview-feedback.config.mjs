// Focused mutation evidence for the user-visible reason shown before an item
// placement is confirmed. It mutates in place; do not edit AppShell while active.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/ui/AppShell.test.tsx'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/item-placement-preview-feedback-mutation.json'
  },
  mutate: ['src/ui/AppShell.tsx:1295-1319'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 80,
    high: 80,
    low: 70
  }
};
