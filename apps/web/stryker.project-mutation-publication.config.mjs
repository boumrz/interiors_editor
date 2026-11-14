// The exact-base rename command shares preparation, while its CAS operation
// remains covered by the rename use-case tests and is not folded into publish.
export default {
  commandRunner: {
    command: [
      'node scripts/check-runtime.mjs',
      './node_modules/.bin/rstest run --config rstest.config.mjs src/application/add-constrained-partition.test.ts src/application/delete-constrained-wall.test.ts src/application/rename-project.test.ts src/application/configure-rectangular-room.test.ts src/application/expand-orthogonal-grid.test.ts src/application/create-parametric-floor-item.test.ts src/application/move-parametric-floor-item.test.ts src/application/resize-parametric-floor-item.test.ts src/application/delete-parametric-floor-item.test.ts'
    ].join(' && ')
  },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: {
    fileName: 'reports/mutation/project-mutation-publication-mutation.json'
  },
  mutate: ['src/application/project-mutation-publication.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: { break: 80, high: 80, low: 70 }
};
