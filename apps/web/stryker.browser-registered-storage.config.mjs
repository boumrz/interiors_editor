if (!process.env.INTERIORS_BROWSER_REGISTERED_MUTATION_ROOT || !process.env.BROWSER_REGISTERED_MUTATION_AUDIT) throw new Error('Use scripts/run-browser-registered-storage-mutation.mjs');
export default {
  commandRunner: { command: 'node scripts/run-browser-registered-storage.mjs --max-failures=1' },
  concurrency: 2,
  coverageAnalysis: 'off',
  inPlace: true,
  disableTypeChecks: '{src,tests}/**/*.{ts,tsx}',
  jsonReporter: { fileName: 'reports/browser-bootstrap/mutation-full.json' },
  mutate: ['src/app/browser-registered-storage-session.ts', 'src/adapters/persistence/browser-registered-scope-store.ts'],
  packageManager: 'pnpm',
  reporters: ['clear-text', 'json'],
  testRunner: 'command',
  thresholds: { high: 80, low: 60, break: 80 },
  timeoutMS: 10000
};
