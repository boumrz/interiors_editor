/** Narrow mutation evidence for the new deterministic floor phase and CAD-style label layout. */
export default {
  commandRunner: {
    command: 'pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/adapters/renderer/webgl2-room-renderer.test.ts src/ui/room-dimension-layout.test.tsx'
  },
  concurrency: 4,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/editor-floor-and-dimension-mutation.json'
  },
  mutate: [
    'src/ui/room-dimension-layout.ts',
    'src/adapters/renderer/webgl2-room-renderer.ts:382-421'
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
