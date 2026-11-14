import base from './stryker.release-startup.config.mjs';

export default {
  ...base,
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/app/telegram-runtime-session.test.ts'
  },
  mutate: ['src/app/telegram-runtime-session.ts'],
  jsonReporter: { fileName: 'reports/mutation/telegram-session.json' }
};
