import base from './stryker.release-startup.config.mjs';

if (!process.env.INTERIORS_TMA_MUTATION_ROOT) {
  throw new Error('Use node scripts/run-telegram-scope-mutation.mjs so the parent cleans timed-out fixtures');
}

export default {
  ...base,
  // Pinned TS 7 has no legacy parseConfigFileTextToJson API used by Stryker's
  // copying preprocessor. As with existing scopes, instrument in place once.
  // Each command builds/serves/tests its own temp fixture and browser profile.
  inPlace: true,
  concurrency: 3,
  disableTypeChecks: '{src,tests}/**/*.{ts,tsx}',
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && node scripts/run-telegram-storage-mutation.mjs'
  },
  mutate: ['src/adapters/persistence/telegram-scope-store.ts'],
  jsonReporter: { fileName: 'reports/mutation/telegram-scope.json' }
};
