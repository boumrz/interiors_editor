// Default: full new-code scope. Optional overrides reproduce focused triage runs.
const sourceFiles = [
  'src/adapters/portable-backup/runtime-v1-wire.ts',
  'src/adapters/portable-backup/runtime-v1-raw-scanner.ts'
];
export default {
  commandRunner: { command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --bail 1 --config rstest.config.mjs src/adapters/portable-backup/runtime-v1-transfer.test.ts src/adapters/portable-backup/runtime-v1-capacity.test.ts src/adapters/portable-backup/runtime-v1-closed-grammar.test.ts src/adapters/portable-backup/runtime-v1-worst-case.test.ts src/adapters/portable-backup/runtime-v1-adversarial.test.ts' },
  concurrency: 4,
  coverageAnalysis: 'off',
  disableTypeChecks: false,
  inPlace: true,
  jsonReporter: { fileName: process.env.S3_MUTATION_REPORT ?? 'reports/s3/mutation.json' },
  mutate: process.env.S3_MUTATE?.split(',') ?? sourceFiles,
  packageManager: 'pnpm',
  reporters: ['clear-text', 'progress', 'json'],
  testRunner: 'command'
};
