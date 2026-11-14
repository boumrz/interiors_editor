// Focused mutation evidence for durable 45-degree contacts on the integer-mm grid.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/domain/add-wall-segment.test.ts src/domain/derive-plan-faces.test.ts src/domain/general-wall-project.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/diagonal-wall-mutation.json'
  },
  mutate: [
    // These are the observable policy decisions in the new exact-contact
    // seam. The BigInt line-equation arithmetic is additionally covered by
    // the asymmetric, negative-denominator and half-millimetre domain cases.
    'src/domain/add-wall-segment.ts:93-98',
    'src/domain/add-wall-segment.ts:239-247',
    'src/domain/add-wall-segment.ts:833-843',
    'src/domain/derive-plan-faces.ts:96-101'
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
