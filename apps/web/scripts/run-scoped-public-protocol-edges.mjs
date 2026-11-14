import './check-runtime.mjs';
import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {qualifyScopedNativeResult} from './scoped-native-result-policy.mjs';
const phase=process.env.SCOPED_PROOF_PHASE??'protocol-edges-baseline',id=process.env.__STRYKER_ACTIVE_MUTANT__??'baseline';
if(!/^[a-zA-Z0-9_-]+$/.test(phase)||id!=='baseline'&&(!/^(0|[1-9][0-9]*)$/.test(id)||BigInt(id)>=2903n))throw new Error('Invalid owned scope/id');
const root=resolve('reports/scoped-protocol-native',phase,id);await mkdir(root,{recursive:true});const evidence=await mkdtemp(join(root,'call-'));
const fixture=await mkdtemp(join(process.env.INTERIORS_SCOPED_NATIVE_RUNROOT??tmpdir(),'interiors-protocol-edges-native-'));
const subjects=['scoped-project-repository.ts','telegram-project-repository.ts','scoped-writer-lease.ts','telegram-writer-lease.ts','telegram-scope-store.ts','browser-registered-project-repository.ts','browser-registered-writer-lease.ts','browser-registered-scope-store.ts'];
const sources=Object.fromEntries(await Promise.all(subjects.map(async name=>[name,createHash('sha256').update(await readFile('src/adapters/persistence/'+name)).digest('hex')])));
const expectedSources={...sources};if(process.env.SCOPED_POISON_SOURCE==='1')expectedSources['scoped-project-repository.ts']='0'.repeat(64);
const selected=JSON.parse(process.env.SCOPED_MUTATED_SUBJECTS??'["scoped-project-repository.ts","telegram-project-repository.ts","scoped-writer-lease.ts","telegram-writer-lease.ts"]');
if(!Array.isArray(selected)||selected.some(name=>!subjects.includes(name))||new Set(selected).size!==selected.length)throw new Error('Invalid actual selected subject set');
const ledger=join(evidence,'activation.jsonl'),reportPath=join(evidence,'report.json');let server,child;const logs=[],issues=[];const started=Date.now();let state='setup-started',outcome,qualification;
const persist=()=>writeFile(join(evidence,'run.json'),JSON.stringify({phase,id,callId:basename(evidence),sources,expectedSources,selected,state,...outcome,elapsedMs:Date.now()-started},null,2));
async function run(args,env=process.env){child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>logs.push(v));child.stderr.on('data',v=>logs.push(v));const value=await new Promise((yes,no)=>{child.once('error',no);child.once('close',(code,signal)=>yes({code,signal}));});child=undefined;return value;}
const stop=()=>child?.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);await persist();
try{
 const allCases=[
  {
    "id": "4e0df2fcb61970e4e134-bc925be2b8ae47fe5bb3",
    "title": "SCOPED-PUBLIC-COMMIT-ACK: real committed publication with lost acknowledgement retries exact receipt without another ID",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 24,
    "column": 1
  },
  {
    "id": "4e0df2fcb61970e4e134-18fdb71066b136a66cbc",
    "title": "SCOPED-PUBLIC-PIN-COMPLETE: completing an unpublished lease refuses without cancellation or row loss",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 44,
    "column": 1
  },
  {
    "id": "4e0df2fcb61970e4e134-19b57f8c7ad31bbd9624",
    "title": "SCOPED-PUBLIC-RESOURCE-PORTS: single exact repair and removed-library hashes preserve byte ownership",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 58,
    "column": 1
  },
  {
    "id": "4e0df2fcb61970e4e134-73b111e43d58dc3286be",
    "title": "SCOPED-PUBLIC-PUBLISH-RESOURCE-version: native mutation after real byte verification refuses atomically",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 81,
    "column": 2
  },
  {
    "id": "4e0df2fcb61970e4e134-9c8c9e7b0f0196587f50",
    "title": "SCOPED-PUBLIC-PUBLISH-RESOURCE-roots: native mutation after real byte verification refuses atomically",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 81,
    "column": 2
  },
  {
    "id": "4e0df2fcb61970e4e134-eb70c76b8aca97dcae08",
    "title": "SCOPED-PUBLIC-PUBLISH-RESOURCE-durable: native mutation after real byte verification refuses atomically",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 81,
    "column": 2
  },
  {
    "id": "4e0df2fcb61970e4e134-a8bb33f728b66881b21b",
    "title": "SCOPED-PUBLIC-PUBLISH-RESOURCE-creationLeaseId: native mutation after real byte verification refuses atomically",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 81,
    "column": 2
  },
  {
    "id": "4e0df2fcb61970e4e134-45ada9e8794ea9661d16",
    "title": "SCOPED-PUBLIC-PUBLISH-WRITER-scope: native fence loss during verification persists explicit takeover before retry",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 103,
    "column": 2
  },
  {
    "id": "4e0df2fcb61970e4e134-35ea107594feccf058ed",
    "title": "SCOPED-PUBLIC-PUBLISH-WRITER-ownerId: native fence loss during verification persists explicit takeover before retry",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 103,
    "column": 2
  },
  {
    "id": "4e0df2fcb61970e4e134-5f630d730516a489c8bb",
    "title": "SCOPED-PUBLIC-PUBLISH-WRITER-fencingToken: native fence loss during verification persists explicit takeover before retry",
    "file": "scoped-public-protocol-edges-e2e.check.ts",
    "line": 103,
    "column": 2
  }
];if(allCases.length!==10)throw new Error('Frozen10-case plan required');
 const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--grep'&&typeof args[1]==='string'&&args[1].startsWith('SCOPED-PUBLIC-')))throw new Error('Only explicit frozen public-case selection is allowed');
 const expectedCases=args.length?allCases.filter(item=>item.title.startsWith(args[1])):allCases;if(args.length&&expectedCases.length!==1)throw new Error('Selected public prefix must resolve exactly one frozen case');
 const built=await run(['node_modules/@rspack/cli/bin/rspack.js','build','--mode','development','--config','rspack.scoped-public-protocol-edges.config.mjs','--output-path',fixture]);
 if(built.code!==0||/Build errors:|unable to locate|Module not found|Cannot find module|\bERROR in\b|failed to compile/i.test(Buffer.concat(logs).toString('utf8')))throw new Error('[SCOPED_SETUP_BUILD_FAILED] '+JSON.stringify(built));
 server=createServer(async(request,response)=>{try{if(!['GET','HEAD'].includes(request.method??'')){response.writeHead(405).end();return;}const pathname=new URL(request.url,'http://127.0.0.1').pathname,file=pathname==='/'?'index.html':pathname.slice(1);if(!file||basename(file)!==file){response.writeHead(404).end();return;}const bytes=await readFile(join(fixture,file));response.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream','Cache-Control':'no-store'}).end(request.method==='HEAD'?undefined:bytes);}catch{response.writeHead(404).end();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Missing own loopback address');
 state='native-running';await persist();outcome=await run(['node_modules/@playwright/test/cli.js','test','--config','playwright.scoped-public-protocol-edges.config.mjs','--max-failures=1',...process.argv.slice(2)],{...process.env,TMPDIR:fixture,TMP:fixture,TEMP:fixture,PLAYWRIGHT_TMA_STORAGE_BASE_URL:`http://127.0.0.1:${address.port}`,PLAYWRIGHT_TMA_STORAGE_OUTPUT_DIR:join(fixture,'results'),SCOPED_SUBJECT_SOURCES:JSON.stringify(expectedSources),SCOPED_SUBJECT_SELECTED:JSON.stringify(selected),SCOPED_ACTIVATION_LEDGER:ledger,SCOPED_NATIVE_REPORT:reportPath});
 state='native-completed';await persist();const runRecord=JSON.parse(await readFile(join(evidence,'run.json'),'utf8')),report=JSON.parse(await readFile(reportPath,'utf8')),rows=(await readFile(ledger,'utf8')).split('\n').filter(Boolean).map(JSON.parse);
 qualification=qualifyScopedNativeResult({run:runRecord,report,rows,output:Buffer.concat(logs).toString('utf8'),expectedCases});
 if(id==='baseline'&&(report.errors??[]).length)qualification.issues.push('baseline-global-error');
 issues.push(...qualification.issues);
 if(outcome.code!==0){try{await cp(join(fixture,'results'),join(evidence,'results'),{recursive:true});}catch(error){issues.push('failure-artifact-copy:'+String(error));}}
}catch(error){if(state==='setup-started')state='setup-failed';issues.push(String(error));await writeFile(join(evidence,'failure.txt'),String(error));}
finally{
 if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}
 const{stdout}=await promisify(execFile)('/bin/ps',['-axo','pid=,command=']);const remaining=stdout.split('\n').filter(line=>line.includes(fixture));if(remaining.length)issues.push('owned-native-processes-not-drained');
 const after=Object.fromEntries(await Promise.all(subjects.map(async name=>[name,createHash('sha256').update(await readFile('src/adapters/persistence/'+name)).digest('hex')])));if(JSON.stringify(after)!==JSON.stringify(sources))issues.push('subject-source-changed');
 await writeFile(join(evidence,'owned-drain.json'),JSON.stringify({fixture,remaining},null,2));await writeFile(join(evidence,'run.log'),Buffer.concat(logs));await persist();
 await writeFile(join(evidence,'qualification.json'),JSON.stringify({qualification,issues,outcome},null,2));process.off('SIGTERM',stop);process.off('SIGINT',stop);
 if(!remaining.length)await rm(fixture,{recursive:true,force:true});
 process.stdout.write(JSON.stringify({evidence,state:issues.length?'invalid-infrastructure':qualification?.state,issues})+'\n');process.exitCode=issues.length?2:outcome?.code??2;
}
