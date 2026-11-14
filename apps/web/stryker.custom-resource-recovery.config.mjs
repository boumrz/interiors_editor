// Focused mutation evidence for atomic custom-resource recovery.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/app/project-controller.test.ts src/ui/AppShell.test.tsx'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/custom-resource-recovery-mutation.json'
  },
  mutate: [
    'src/app/project-controller.ts:378-475',
    'src/app/project-controller.ts:625-679'
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
