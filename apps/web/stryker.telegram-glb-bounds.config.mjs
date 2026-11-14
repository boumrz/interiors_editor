if (!process.env.INTERIORS_TELEGRAM_GLB_BOUNDS_MUTATION_ROOT) throw new Error('Use the isolated GLB bounds mutation wrapper');
export default {
  commandRunner: { command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/ui/bounded-local-glb-files.test.tsx' },
  mutate: ['src/ui/bounded-local-glb-files.ts'],
  inPlace: true,
  concurrency: 2,
  disableTypeChecks: '**/*.{ts,tsx}',
  coverageAnalysis: 'off',
  jsonReporter: { fileName: 'reports/mutation/telegram-glb-bounds.json' },
  packageManager: 'pnpm',
  testRunner: 'command',
  reporters: ['clear-text', 'json'],
  thresholds: { break: 80, high: 80, low: 60 },
  timeoutMS: 10000
};
