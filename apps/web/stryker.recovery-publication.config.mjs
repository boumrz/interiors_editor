import { sectionScope, recoveryMutationConfig } from './scripts/stryker-recovery-scopes.mjs';

export default recoveryMutationConfig('publication', [
  sectionScope('src/application/create-custom-glb-floor-item.ts',
    '\t\tconst glbBytes = source.glbBytes.slice();',
    '\t\tconst serializedProject ='),
  sectionScope('src/application/create-custom-glb-floor-item.ts',
    '\t\tlet publication:',
    '\tprivate async discardStagedResource('),
  sectionScope('src/application/import-portable-backup.ts',
    '\t\tlet publication:',
    '\tprivate async stageResources('),
  sectionScope('src/application/import-portable-backup.ts',
    '\t\t\t\tconst existing = await store.read(resource.resourceHash);',
    '\t\tlet lease: PinStagingLease | undefined;\n\t\tif (resourcesToWrite.length > 0 && this.dependencies.pinStaging) {'),
  'src/domain/restart-project.ts',
], [
  'src/application/create-custom-glb-floor-item.test.ts',
  'src/application/import-portable-backup.test.ts',
  'src/domain/restart-project.test.ts',
  'src/app/project-controller-recovery.test.ts',
]);
