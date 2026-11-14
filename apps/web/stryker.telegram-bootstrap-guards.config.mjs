import base from './stryker.release-startup.config.mjs';

export default {
  ...base,
  concurrency: 3,
  disableTypeChecks: '{src,tests}/**/*.{ts,tsx}',
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/app/telegram-release-preflight.test.ts src/adapters/telegram/context-state.test.ts'
  },
  mutate: ['src/app/telegram-release-preflight.ts', 'src/adapters/telegram/context-state.ts'],
  jsonReporter: { fileName: 'reports/mutation/telegram-bootstrap-guards.json' }
};
