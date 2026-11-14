import './check-runtime.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const scope=process.argv[2];if(!['delivery','session','session-followup'].includes(scope))throw new Error('Choose delivery or session mutation scope');
const root=await mkdtemp(join(tmpdir(),'interiors-tma-entry-mutation-'));
try{const child=spawn(process.execPath,[resolve('node_modules/@stryker-mutator/core/bin/stryker.js'),'run',`stryker.telegram-entry-${scope}.config.mjs`],{stdio:'inherit',env:{...process.env,TMPDIR:root,TMP:root,TEMP:root}});const[code,signal]=await once(child,'exit');if(code!==0)throw new Error(`Telegram ${scope} mutation stopped (${code??signal})`);}finally{await rm(root,{recursive:true,force:true});}
