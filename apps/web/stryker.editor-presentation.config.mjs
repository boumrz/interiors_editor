// Narrow mutation evidence for deterministic on-canvas measurements and local
// greybox-preview geometry. It runs in place; do not edit those modules while active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/ui/room-measurement.test.tsx src/ui/greybox-catalog-preview.test.tsx'
  },
  concurrency: 4,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/editor-presentation-mutation.json'
  },
  mutate: [
    'src/ui/room-measurement.ts',
    'src/ui/greybox-catalog-preview.ts'
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
