import base from './stryker.telegram-scope.config.mjs';

export default {
  ...base,
  mutate: ['src/adapters/persistence/telegram-project-repository.ts'],
  jsonReporter: { fileName: 'reports/mutation/telegram-project.json' }
};
