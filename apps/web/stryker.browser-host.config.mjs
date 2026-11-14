import base from './stryker.release-startup.config.mjs';

export default {
  ...base,
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/app/editor-host-boundary.test.ts src/app/browser-host-startup.test.ts src/app/release-startup.test.ts'
  },
  mutate: ['src/app/browser-editor-app.tsx'],
  jsonReporter: { fileName: 'reports/mutation/browser-host.json' }
};
