import { methodScopes, recoveryMutationConfig } from './scripts/stryker-recovery-scopes.mjs';

export default recoveryMutationConfig('resources', [
  ...methodScopes('src/adapters/persistence/pin-staging-lease-coordinator.ts', ['reconcile', 'nextLeaseId']),
  ...methodScopes('src/adapters/persistence/indexeddb-custom-asset-resource-store.ts', [
    'writeIfAbsent', 'writeIfAbsentPinned', 'protectExistingResource',
    'list', 'register', 'remove', 'listRemovedResourceHashes',
  ]),
  'src/application/register-custom-glb-library-asset.ts',
], [
  'src/adapters/persistence/indexeddb-custom-asset-resource-store.test.ts',
  'src/adapters/persistence/pin-staging-lease-coordinator.test.ts',
  'src/application/create-custom-glb-floor-item.test.ts',
  'src/application/import-portable-backup.test.ts',
  'src/app/project-controller-recovery.test.ts',
]);
