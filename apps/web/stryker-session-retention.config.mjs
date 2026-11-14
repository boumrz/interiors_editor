// Focused mutation scope for the SessionRetentionPolicy vertical slice.
export default {
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/application/session-retention-policy.test.ts src/application/session-retention-project-repository.test.ts'
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/session-retention-mutation.json'
  },
  mutate: [
	'src/application/backup-feasibility-policy.ts',
    'src/application/session-retention-policy.ts',
    'src/application/session-retention-project-repository.ts'
  ],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  tempDirName: '.stryker-session-retention-tmp'
};
