import base from './stryker.release-startup.config.mjs';

// Full new writer policy and the changed shared publication/retry guards.
// Direct argument forwarding is additionally verified by explicit behavior cases.
export default {
  ...base,
  commandRunner: {
    command: 'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.mutation.config.mjs'
  },
  mutate: [
    'src/adapters/persistence/telegram-writer-lease.ts',
    'src/application/project-mutation-publication.ts',
    'src/application/session-retention-project-repository.ts:43-46',
    'src/application/session-retention-project-repository.ts:51-59',
    'src/adapters/persistence/fenced-project-repository.ts:120-132',
    'src/adapters/persistence/durable-project-repository.ts:65-76',
    'src/app/project-controller.ts:3331-3336',
    'src/app/project-controller.ts:3355-3360',
    'src/app/project-controller.ts:3685-3693',
    'src/app/project-controller.ts:3780-3788',
    'src/app/project-controller.ts:3820-3832'
  ],
  jsonReporter: { fileName: 'reports/mutation/telegram-publication-guards.json' }
};
