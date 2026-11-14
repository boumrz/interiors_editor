import base from './rspack.config.mjs';
import { resolve } from 'node:path';
const subjects=['src/ui/local-file-transfer.tsx','src/ui/local-glb-resource.ts'].map(value=>resolve(value));
export default (environment,args)=>{const config=base(environment,args);return{...config,cache:false,module:{...config.module,rules:[...config.module.rules,{enforce:'pre',include:subjects,use:[resolve('tests/verification/local-file-source-loader.cjs')]}]}};};
