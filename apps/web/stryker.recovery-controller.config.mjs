import { methodScopes, recoveryMutationConfig } from './scripts/stryker-recovery-scopes.mjs';

export default recoveryMutationConfig('controller', methodScopes('src/app/project-controller.ts', [
  'exportRecoveryDraft',
  'importRecoveryDraft',
  'recoveryReadOnlyProject',
  'listRemovedCustomGlbLibraryResourceHashes',
  'removeCustomGlbLibraryAsset',
  'repairCustomGlbResource',
  'repairCustomGlbResources',
  'repairResourcesFromPortableBackup',
  'enterCurrentResourceRecovery',
  'finishExactResourceRepair',
]), [
  'src/app/project-recovery.test.ts',
  'src/app/project-controller-recovery.test.ts',
  'src/app/project-controller.test.ts',
]);
