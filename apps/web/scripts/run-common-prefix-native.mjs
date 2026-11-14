import './check-runtime.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
const phase=process.env.SCOPED_PROOF_PHASE??'baseline';
const id=process.env.__STRYKER_ACTIVE_MUTANT__??'baseline';
if(!/^[a-zA-Z0-9_-]+$/.test(phase)||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Invalid owned evidence key');
const invocationRoot=resolve('reports/scoped-protocol-native',phase,id);await mkdir(invocationRoot,{recursive:true});
const evidence=await mkdtemp(join(invocationRoot,'call-'));
const callId=basename(evidence);
const fixture=await mkdtemp(join(process.env.INTERIORS_SCOPED_NATIVE_RUNROOT??tmpdir(),'interiors-scoped-native-fixture-'));
const subjects=['scoped-project-repository.ts','telegram-project-repository.ts','scoped-writer-lease.ts','telegram-writer-lease.ts','telegram-scope-store.ts','browser-registered-project-repository.ts','browser-registered-writer-lease.ts','browser-registered-scope-store.ts'];
const sources=Object.fromEntries(await Promise.all(subjects.map(async(name)=>[name,createHash('sha256').update(await readFile(`src/adapters/persistence/${name}`)).digest('hex')])));
const expectedSources={...sources};if(process.env.SCOPED_POISON_SOURCE==='1')expectedSources['scoped-project-repository.ts']='0'.repeat(64);
const selected=JSON.parse(process.env.SCOPED_MUTATED_SUBJECTS??'["scoped-project-repository.ts","telegram-project-repository.ts","scoped-writer-lease.ts","telegram-writer-lease.ts"]');
const ledger=join(evidence,'activation.jsonl'),reportPath=join(evidence,'report.json');
const logs=[];let server,runningChild;
process.once("SIGTERM",()=>runningChild?.kill("SIGTERM"));process.once("SIGINT",()=>runningChild?.kill("SIGINT"));
async function run(args,env=process.env){
 const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});runningChild=child;
 child.stdout.on('data',value=>logs.push(value));child.stderr.on('data',value=>logs.push(value));
 const[code,signal]=await once(child,'exit');runningChild=undefined;return{code,signal};
}
const started=Date.now();let outcome;let state='setup-started';
async function writeRun(){await writeFile(join(evidence,'run.json'),JSON.stringify({phase,id,callId,sources,expectedSources,selected,state,...outcome,elapsedMs:Date.now()-started},null,2));}
await writeRun();
try{
 for(const file of ['package.json','src/ui/global.css'])await readFile(file);
 const built=await run([resolve('node_modules/@rspack/cli/bin/rspack.js'),'build','--mode','development','--config','rspack.common-prefix-native.config.mjs','--output-path',fixture]);
 if(built.code!==0||/Build errors:|unable to locate|Module not found|Cannot find module|\bERROR in\b/.test(Buffer.concat(logs).toString('utf8')))throw new Error(`[SCOPED_SETUP_BUILD_FAILED] ${JSON.stringify(built)}`);
 server=createServer(async(request,response)=>{
  try{const pathname=new URL(request.url,'http://127.0.0.1').pathname,file=pathname==='/'?'index.html':pathname.slice(1);if(!file||basename(file)!==file){response.writeHead(404).end();return;}const bytes=await readFile(join(fixture,file));response.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream','Cache-Control':'no-store'}).end(bytes);}catch{response.writeHead(404).end();}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Missing owned loopback address');
 state='native-running';await writeRun();
 outcome=await run([resolve('node_modules/@playwright/test/cli.js'),'test','--config','playwright.common-prefix-native.config.mjs','--max-failures=1',...process.argv.slice(2)],{...process.env,PLAYWRIGHT_TMA_STORAGE_BASE_URL:`http://127.0.0.1:${address.port}`,PLAYWRIGHT_TMA_STORAGE_OUTPUT_DIR:join(fixture,'results'),SCOPED_SUBJECT_SOURCES:JSON.stringify(expectedSources),SCOPED_SUBJECT_SELECTED:JSON.stringify(selected),SCOPED_ACTIVATION_LEDGER:ledger,SCOPED_NATIVE_REPORT:reportPath});
 state='native-completed';
 if(outcome.code!==0)await cp(join(fixture,'results'),join(evidence,'results'),{recursive:true}).catch(()=>undefined);
 await writeRun();
 if(outcome.code!==0)throw new Error(`[SCOPED_NATIVE_TEST_FAILED] ${JSON.stringify(outcome)}`);
}catch(error){
 if(state==='setup-started')state='setup-failed';
 await writeFile(join(evidence,'failure.txt'),String(error));throw error;
}finally{
 await writeFile(join(evidence,'run.log'),Buffer.concat(logs));
 await writeRun();
 if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}
 await rm(fixture,{recursive:true,force:true});
 process.stdout.write(`Scoped native evidence ${evidence}\n`);
}
