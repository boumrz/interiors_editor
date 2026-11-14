// Focused mutation evidence for deletion-only current-Project RecoveryChangeSet.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
  commandRunner: {
    command: [
      'pnpm run check:runtime',
      [
        'pnpm exec rstest run --config rstest.config.mjs',
        'src/domain/recover-unresolved-custom-glb-references.test.ts',
        'src/application/recover-unresolved-custom-glb-references.test.ts',
        'src/app/project-controller.test.ts',
        'src/ui/AppShell.test.tsx'
      ].join(' ')
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/recovery-changeset-mutation.json'
  },
  mutate: [
    'src/domain/recover-unresolved-custom-glb-references.ts',
    'src/application/recover-unresolved-custom-glb-references.ts',
    // The controller orchestration is covered by direct and browser tests;
    // mutate its irreversible guard that rejects a changed resource set.
    'src/app/project-controller.ts:272-275'
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
