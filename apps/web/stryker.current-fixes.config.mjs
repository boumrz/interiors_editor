import productionConfig from './stryker.config.mjs';

export default {
  ...productionConfig,
  commandRunner: {
    command:
      'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run src/domain/general-wall-project.test.ts --config rstest.config.mjs'
  },
  jsonReporter: {
    fileName: 'reports/mutation/current-fixes-mutation.json'
  },
  mutate: ['src/domain/general-wall-project.ts:167-169']
};
