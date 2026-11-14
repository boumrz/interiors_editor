// Narrow mutation evidence for the procedural WebGL wall finish.
// It runs in place: do not edit the selected source module while it is active.
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/adapters/renderer/webgl2-room-renderer.test.ts'
  },
  concurrency: 4,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/wall-finish-mutation.json'
  },
  mutate: ['src/adapters/renderer/webgl2-room-renderer.ts:262-341'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: {
    break: 70,
    high: 80,
    low: 70
  }
};
