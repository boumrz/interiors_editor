import { recoveryMutationConfig } from './scripts/stryker-recovery-scopes.mjs';

export default recoveryMutationConfig('codec', ['src/app/project-recovery.ts'], [
  'src/app/project-recovery.test.ts',
  'src/app/project-controller-recovery.test.ts',
  'src/app/project-controller.test.ts',
]);
