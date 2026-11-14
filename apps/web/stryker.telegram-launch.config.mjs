import base from './stryker.release-startup.config.mjs';

export default {
  ...base,
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/adapters/telegram/signed-launch.test.ts'
  },
  mutate: ['src/adapters/telegram/signed-launch.ts'],
  jsonReporter: { fileName: 'reports/mutation/telegram-launch.json' }
};
