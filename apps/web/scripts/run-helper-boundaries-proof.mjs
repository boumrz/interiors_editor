import './check-runtime.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=await mkdtemp(join(tmpdir(),'interiors-helper-boundary-mutants-'));
const activationRoot=resolve('reports/helper-boundaries/activation');
await mkdir(activationRoot,{recursive:true});
try{
 const child=spawn(process.execPath,[resolve('node_modules/@stryker-mutator/core/bin/stryker.js'),'run','stryker.helper-boundaries.config.mjs'],{stdio:'inherit',env:{...process.env,TMPDIR:root,TMP:root,TEMP:root,INTERIORS_HELPER_BOUNDARY_ACTIVATION_ROOT:activationRoot}});
 const[code,signal]=await once(child,'exit');if(code!==0)throw new Error(`Helper boundary proof stopped (${code??signal})`);
}finally{await rm(root,{recursive:true,force:true})}
