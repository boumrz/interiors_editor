import storageConfig from './rspack.telegram-storage-test.config.mjs';
import {rspack} from '@rspack/core';
import {resolve} from 'node:path';
const subjects=['scoped-project-repository.ts','telegram-project-repository.ts','scoped-writer-lease.ts','telegram-writer-lease.ts','telegram-scope-store.ts','browser-registered-project-repository.ts','browser-registered-writer-lease.ts','browser-registered-scope-store.ts'];
export default (environment,arguments_)=>{
 const base=storageConfig(environment,arguments_);
 return {...base,entry:process.env.SCOPED_NATIVE_CONTROL==="build"?"./tests/verification/owned-nonexistent-native-entry.ts":"./tests/verification/scoped-combined-harness.ts",plugins:[new rspack.DefinePlugin({__INTERIORS_TEST_SEAM__:'false'}),...base.plugins],cache:false,module:{...base.module,rules:[...(base.module?.rules??[]),{enforce:'pre',test:(resource)=>typeof resource==='string'&&subjects.some((name)=>resource.endsWith(`/adapters/persistence/${name}`)),use:[{loader:resolve('tests/verification/scoped-subject-loader.cjs')}]}]}};
};
