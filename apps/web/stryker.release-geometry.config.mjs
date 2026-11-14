export default {
  commandRunner: {
    command: './node_modules/.bin/rstest run --config rstest.config.mjs src/ui/release-wall-gestures.test.tsx src/ui/wall-draft.test.tsx src/ui/editor-viewport.test.tsx src/adapters/renderer/release-wall-bodies.test.ts src/adapters/renderer/release-wall-rendering.test.ts src/adapters/renderer/rectangular-room-projection.test.ts src/adapters/renderer/three-webgl2-room-renderer.test.ts src/adapters/renderer/webgl2-room-renderer.test.ts'
  },
  concurrency: 2,
  coverageAnalysis: 'off',
  inPlace: false,
  // Rspack resolves this self-contained project's tsconfig; there are no external
  // extends/references to rewrite. TS7 exposes no legacy compiler JS API.
  tsconfigFile: './.stryker-no-external-tsconfig-references.json',
  tempDirName: '.stryker-release-geometry',
  ignorePatterns: ['/dist', '/test-results', '/playwright-report', '/.stryker-release-geometry', '/.stryker-release-ui'],
  jsonReporter: { fileName: 'reports/mutation/release-geometry.json' },
  mutate: [
    'src/adapters/renderer/wall-body-projection.ts',
    'src/ui/wall-draft.ts:22-69',
    'src/ui/editor-viewport.ts:163-175',
    'src/adapters/renderer/rectangular-room-projection.ts:461-473',
    'src/adapters/renderer/three-webgl2-room-renderer.ts:371-401',
    'src/adapters/renderer/webgl2-room-renderer.ts:354-364'
  ],
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: { break: 80, high: 90, low: 80 }
};
