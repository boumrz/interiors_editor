import base from './rspack.config.mjs';
import { resolve } from 'node:path';
const subjects=['src/adapters/persistence/indexeddb-custom-asset-resource-store.ts','src/adapters/portable-backup/browser-registered-project-exporter.ts','src/app/project-controller.ts','src/app/registered-project-controller.ts'].map(value=>resolve(value));
export default (environment,args)=>{const config=base(environment,args);return{...config,cache:false,module:{...config.module,rules:[...config.module.rules,{enforce:'pre',include:subjects,use:[resolve('tests/verification/node-timeout-source-loader.cjs')]}]}};};
