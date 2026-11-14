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
const phase=process.env.SCOPED_PROOF_PHASE??'additional-baseline',id=process.env.__STRYKER_ACTIVE_MUTANT__??'baseline';
if(!/^[a-zA-Z0-9_-]+$/.test(phase)||id!=='baseline'&&(!/^(0|[1-9][0-9]*)$/.test(id)||BigInt(id)>=2903n))throw new Error('Invalid owned scope/id');
const root=resolve('reports/common-additional-public/native',phase,id);await mkdir(root,{recursive:true});const evidence=await mkdtemp(join(root,'call-'));
const fixture=await mkdtemp(join(process.env.INTERIORS_SCOPED_NATIVE_RUNROOT??tmpdir(),'interiors-common-additional-native-'));
const subjects=['scoped-project-repository.ts','telegram-project-repository.ts','scoped-writer-lease.ts','telegram-writer-lease.ts','telegram-scope-store.ts','browser-registered-project-repository.ts','browser-registered-writer-lease.ts','browser-registered-scope-store.ts'];
const sources=Object.fromEntries(await Promise.all(subjects.map(async name=>[name,createHash('sha256').update(await readFile('src/adapters/persistence/'+name)).digest('hex')])));
const expectedSources={...sources};if(process.env.SCOPED_POISON_SOURCE==='1')expectedSources['scoped-project-repository.ts']='0'.repeat(64);
const selected=['scoped-project-repository.ts','telegram-project-repository.ts','scoped-writer-lease.ts','telegram-writer-lease.ts'];
const ledger=join(evidence,'activation.jsonl'),reportPath=join(evidence,'report.json');let server,child;const logs=[],issues=[];const started=Date.now();let state='setup-started',outcome,qualification;
const persist=()=>writeFile(join(evidence,'run.json'),JSON.stringify({phase,id,callId:basename(evidence),sources,expectedSources,selected,state,...outcome,elapsedMs:Date.now()-started},null,2));
async function run(args,env=process.env){child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',v=>logs.push(v));child.stderr.on('data',v=>logs.push(v));const value=await new Promise((yes,no)=>{child.once('error',no);child.once('close',(code,signal)=>yes({code,signal}));});child=undefined;return value;}
const stop=()=>child?.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);await persist();
try{
 const expectedCases=[
  {
    "id": "5eed6800250a6c4c687c-2ad4dd241b8754f0e3b2",
    "title": "COMMON-ADDITIONAL-SHARED-prepared-other: takeover preserves independent resource roots",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 29,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-916e5b89f83900067107",
    "title": "COMMON-ADDITIONAL-SHARED-published-other: takeover preserves independent resource roots",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 29,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-b1d5b8985678a245d6b5",
    "title": "COMMON-ADDITIONAL-SHARED-prepared-library: takeover preserves independent resource roots",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 29,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-0930abe3b0f1fa6873ff",
    "title": "COMMON-ADDITIONAL-RECONCILE-attempt: late native snapshot change never authorizes cleanup",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 63,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-672d263c094593cfdc06",
    "title": "COMMON-ADDITIONAL-RECONCILE-revision: late native snapshot change never authorizes cleanup",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 63,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-5a5c2e5779b3b91673ed",
    "title": "COMMON-ADDITIONAL-RECONCILE-stage: late native snapshot change never authorizes cleanup",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 63,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-1851c5e15527f518a052",
    "title": "COMMON-ADDITIONAL-RECONCILE-pin: late native snapshot change never authorizes cleanup",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 63,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-891eecfe07b7a8880908",
    "title": "COMMON-ADDITIONAL-BASE-existing-no-base: a missing predecessor proof cannot create or replace a Project",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 90,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-9ce2e33d2b61e9019bb8",
    "title": "COMMON-ADDITIONAL-BASE-absent-with-base: a missing predecessor proof cannot create or replace a Project",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 90,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-ad453bcafe946b66cc5f",
    "title": "COMMON-ADDITIONAL-HISTORY-project: original creation must match before history staging",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 110,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-7e05bcaf3789aca254d9",
    "title": "COMMON-ADDITIONAL-HISTORY-revision: original creation must match before history staging",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 110,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-2ae1cf76bb74b6eb5177",
    "title": "COMMON-ADDITIONAL-HISTORY-checksum: original creation must match before history staging",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 110,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-65ca9f10313ed2483a82",
    "title": "COMMON-ADDITIONAL-HISTORY-serialization: original creation must match before history staging",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 110,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-53022c5f2e9ceba8480e",
    "title": "COMMON-ADDITIONAL-HISTORY-intent: original creation must match before history staging",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 110,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-46fadf988308937db8a1",
    "title": "COMMON-ADDITIONAL-STAGE: published journal plus another prepared attempt cannot authorize an extra stage",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 132,
    "column": 1
  },
  {
    "id": "5eed6800250a6c4c687c-a05672281c939d5a53d8",
    "title": "COMMON-ADDITIONAL-FENCE-extra: a late invalid writer fact requires explicit takeover",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 146,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-b95db7d68fd4b5179165",
    "title": "COMMON-ADDITIONAL-FENCE-deleted: a late invalid writer fact requires explicit takeover",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 146,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-1c6d882bb4eac1c145ff",
    "title": "COMMON-ADDITIONAL-FENCE-negative-clock: a late invalid writer fact requires explicit takeover",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 146,
    "column": 2
  },
  {
    "id": "5eed6800250a6c4c687c-10e33dda4a6c59739b91",
    "title": "COMMON-ADDITIONAL-EPOCH-ZERO: zero is a valid writer epoch and can publish durably",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 164,
    "column": 1
  },
  {
    "id": "5eed6800250a6c4c687c-1421dbfc8469d0ce90a9",
    "title": "COMMON-ADDITIONAL-FOREIGN-CREATION: cleaning the last owned root does not garbage-collect another lease's bytes",
    "file": "scoped-public-additional-e2e.check.ts",
    "line": 178,
    "column": 1
  }
];if(expectedCases.length!==20)throw new Error('Frozen20-case plan required');
 const built=await run(['node_modules/@rspack/cli/bin/rspack.js','build','--mode','development','--config','rspack.scoped-public-additional.config.mjs','--output-path',fixture]);
 if(built.code!==0||/Build errors:|unable to locate|Module not found|Cannot find module|\bERROR in\b|failed to compile/i.test(Buffer.concat(logs).toString('utf8')))throw new Error('[SCOPED_SETUP_BUILD_FAILED] '+JSON.stringify(built));
 server=createServer(async(request,response)=>{try{if(!['GET','HEAD'].includes(request.method??'')){response.writeHead(405).end();return;}const pathname=new URL(request.url,'http://127.0.0.1').pathname,file=pathname==='/'?'index.html':pathname.slice(1);if(!file||basename(file)!==file){response.writeHead(404).end();return;}const bytes=await readFile(join(fixture,file));response.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream','Cache-Control':'no-store'}).end(request.method==='HEAD'?undefined:bytes);}catch{response.writeHead(404).end();}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Missing own loopback address');
 state='native-running';await persist();outcome=await run(['node_modules/@playwright/test/cli.js','test','--config','playwright.scoped-public-additional.config.mjs','--max-failures=1'],{...process.env,TMPDIR:fixture,TMP:fixture,TEMP:fixture,PLAYWRIGHT_TMA_STORAGE_BASE_URL:`http://127.0.0.1:${address.port}`,PLAYWRIGHT_TMA_STORAGE_OUTPUT_DIR:join(fixture,'results'),SCOPED_SUBJECT_SOURCES:JSON.stringify(expectedSources),SCOPED_SUBJECT_SELECTED:JSON.stringify(selected),SCOPED_ACTIVATION_LEDGER:ledger,SCOPED_NATIVE_REPORT:reportPath});
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
