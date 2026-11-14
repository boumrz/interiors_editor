export default {
  commandRunner: {
    command: './node_modules/.bin/rstest run --config rstest.config.mjs src/domain/followup-wall-topology.test.ts src/domain/derive-plan-faces.test.ts src/domain/general-wall-project.test.ts src/domain/add-wall-segment.test.ts'
  },
  concurrency: 2,
  coverageAnalysis: 'off',
  inPlace: false,
  // Rspack uses this self-contained project's tsconfig. TS7 has no legacy
  // compiler JavaScript API for Stryker's external-reference preprocessing.
  tsconfigFile: './.stryker-no-external-tsconfig-references.json',
  tempDirName: '.stryker-followup-geometry',
  ignorePatterns: ['/dist', '/test-results', '/playwright-report', '/.stryker-release-geometry', '/.stryker-release-ui', '/.stryker-followup-geometry', '/.stryker-followup-ui'],
  jsonReporter: { fileName: 'reports/mutation/followup-geometry.json' },
  mutate: ['src/domain/derive-plan-faces.ts:636-638', 'src/domain/derive-plan-faces.ts:654-689'],
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: { break: 80, high: 90, low: 80 }
};
