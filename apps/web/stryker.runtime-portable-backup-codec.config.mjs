export default {
  commandRunner: { command: `node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --bail 1 --config rstest.config.mjs ${process.env.S3_ENVELOPE_TEST_FILTER ?? 'src/adapters/portable-backup/runtime-portable-backup-codec.test.ts'}` },
  concurrency: Number(process.env.S3_ENVELOPE_CONCURRENCY ?? 4),
  coverageAnalysis: 'off',
  disableTypeChecks: false,
  inPlace: true,
  jsonReporter: { fileName: process.env.S3_ENVELOPE_MUTATION_REPORT ?? 'reports/s3-envelope/mutation.json' },
  mutate: process.env.S3_ENVELOPE_MUTATE?.split(',') ?? ['src/adapters/portable-backup/runtime-portable-backup-codec.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'progress', 'json'],
  testRunner: 'command'
};
