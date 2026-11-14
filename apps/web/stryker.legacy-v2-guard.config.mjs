// Focused mutation evidence for the legacy V2 quarantine boundary.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/app/project-controller.test.ts src/ui/AppShell.test.tsx'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/legacy-v2-guard-mutation.json'
  },
  mutate: [
    'src/app/project-controller.ts:313-314',
    'src/app/project-controller.ts:350-351',
    'src/app/project-controller.ts:408-409',
    'src/app/project-controller.ts:443-444',
    'src/app/project-controller.ts:513-514',
    'src/app/project-controller.ts:537-538',
    'src/app/project-controller.ts:561-562'
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
