import { sectionScope } from './scripts/stryker-recovery-scopes.mjs';

export default {
  thresholds: { break: 80, high: 80, low: 70 },
  commandRunner: { command: 'node scripts/check-runtime.mjs && node node_modules/@rstest/core/bin/rstest.js run --config rstest.config.mjs src/domain/custom-glb-asset.test.ts src/application/create-custom-glb-floor-item.test.ts' },
  concurrency: 1,
  coverageAnalysis: 'off',
  inPlace: true,
  jsonReporter: { fileName: 'reports/mutation/catalog-wall-domain-mutation.json' },
  mutate: [sectionScope('src/domain/custom-glb-asset.ts', 'export function createCustomGlbWallItem(', 'export function validateCustomGlbAssetDefinition(')],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command'
};
