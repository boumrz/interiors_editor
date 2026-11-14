import './check-runtime.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=await mkdtemp(join(tmpdir(),'interiors-tma-host-mutation-'));
try{
 const child=spawn(process.execPath,[resolve('node_modules/@stryker-mutator/core/bin/stryker.js'),'run','stryker.telegram-host.config.mjs'],{stdio:'inherit',env:{...process.env,TMPDIR:root,TMP:root,TEMP:root,INTERIORS_TELEGRAM_HOST_MUTATION_ROOT:root}});
 const[code,signal]=await once(child,'exit');if(code!==0)throw new Error(`Telegram host mutation gate stopped (${code??signal})`);
}finally{await rm(root,{recursive:true,force:true})}
