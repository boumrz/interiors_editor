import test from 'node:test';import assert from 'node:assert/strict';import {renamedReadonlyCounter} from './telegram-readonly-counter-matrix.ts';
test('a renamed genuine counter keeps exactly its original reserved value and two metadata fields',()=>{const original={key:'counter',lastReserved:'17'};const renamed=renamedReadonlyCounter(original);assert.deepEqual(renamed,{key:'a-counter',lastReserved:'17'});assert.deepEqual(original,{key:'counter',lastReserved:'17'});assert.equal(Object.keys(renamed).length,2);assert.ok('a-counter'.localeCompare('identity')<0);});
test('a fixture with a wrong original counter address or shape fails before producing a second fault',()=>{for(const value of[undefined,[],{key:'other',lastReserved:'17'},{key:'counter',lastReserved:17},{key:'counter',lastReserved:'17',extra:true}])assert.throws(()=>renamedReadonlyCounter(value));});

// New scope's denial-only adapter/closure calibration; no successful DB or TX supplied.
import {createTelegramReadonlyPublicCounter,runCounterTechnicalCleanup} from '../browser/telegram-readonly-public-regressions-harness.ts';
import {validatePublicResults,validatePublicClosure,observePublicCompletion} from '../../scripts/run-reader-public-regressions.mjs';
test('counter adapter binds the exact derived existing name and no version argument before a synchronous open refusal',async()=>{
 const failure=new Error('controlled open refusal'),calls=[];
 const api=createTelegramReadonlyPublicCounter({indexedDb:{open(...args){calls.push(args);throw failure;}},databaseName:async()=> 'denial-only-existing-scope',rename:renamedReadonlyCounter});
 await assert.rejects(api.renameCounterKey(),error=>error===failure);
 assert.deepEqual(calls,[['denial-only-existing-scope']]);
});
test('counter adapter preserves the actual ordinary asynchronous request refusal without a successful DB or transaction',async()=>{
 const failure=new Error('controlled async refusal'),opening={error:failure};
 const api=createTelegramReadonlyPublicCounter({indexedDb:{open(){queueMicrotask(()=>opening.onerror());return opening;}},databaseName:async()=> 'denial-only-existing-scope',rename:renamedReadonlyCounter});
 await assert.rejects(api.renameCounterKey(),error=>error===failure);
});
test('missing native DB is aborted instead of provisioning and never supplies a successful DB',async()=>{
 let aborted=0;const opening={error:new DOMException('controlled aborted absent open','AbortError'),transaction:{abort(){aborted++;queueMicrotask(()=>opening.onerror());}}};
 const api=createTelegramReadonlyPublicCounter({indexedDb:{open(){queueMicrotask(()=>opening.onupgradeneeded());return opening;}},databaseName:async()=> 'denial-only-missing-scope',rename:renamedReadonlyCounter});
 await assert.rejects(api.renameCounterKey());assert.equal(aborted,1);
});
test('failed signed-scope resolution refuses before any factory access',async()=>{
 const failure=new Error('controlled scope refusal');let opens=0;
 const api=createTelegramReadonlyPublicCounter({indexedDb:{open(){opens++;throw Error('must not open');}},databaseName:async()=>{throw failure;},rename:renamedReadonlyCounter});
 await assert.rejects(api.renameCounterKey(),error=>error===failure);assert.equal(opens,0);
});
test('public completion tags fulfilled, rejected undefined and pending independently',async()=>{
 assert.deepEqual(await observePublicCompletion(Promise.resolve('actual value'),10),{kind:'fulfilled',value:'actual value'});
 assert.deepEqual(await observePublicCompletion(Promise.reject(undefined),10),{kind:'rejected',reason:undefined});
 assert.deepEqual(await observePublicCompletion(new Promise(()=>{}),5),{kind:'pending'});
});
function fixture(count=2){const sourceHashes={'src/a.ts':'a'.repeat(64),'src/b.ts':'b'.repeat(64)},cases=Array.from({length:count},(_,i)=>({id:'case-'+i,file:'/owned/cases.check.ts',title:'public-'+i})),rows=cases.map(c=>({...c,pid:400,workerIndex:0,parallelIndex:0,globalActive:null,modules:Object.entries(sourceHashes).map(([path,sha])=>({path,sha,instrumented:false,actual:null})),valid:true})),body=cases.flatMap(c=>[{...c,pid:400,phase:'entered'},{...c,pid:400,phase:'settled',outcome:'fulfilled'}]),results=cases.map(c=>({...c,status:'passed',retry:0,workerIndex:0,parallelIndex:0,errors:[]}));return{cases,rows,body,results,sourceHashes,rawEnds:results.map(r=>({...r,cliPID:300,errors:[]})),cliPID:300,code:0,signal:null,stats:{expected:count,unexpected:0,skipped:0,flaky:0},globalErrors:[]};}
test('plain-only exact cohort binds source/owning BODY/result/raw reporter without a synthetic failure claim',()=>{assert.deepEqual(validatePublicResults(fixture()),[]);});
test('old or missing source/body identities and primitive rejection cannot become a clean check',()=>{
 for(const tamper of [v=>v.rows[0].modules[0].sha='0'.repeat(64),v=>v.body.pop(),v=>v.body[1].outcome='rejected',v=>v.body[0].file='/foreign/cases.check.ts',v=>v.rawEnds[0].cliPID=999,v=>v.results[0].errors=[{}],v=>v.results[0].status='failed',v=>v.globalErrors.push({message:'foreign global'})]){const v=fixture();tamper(v);assert.ok(validatePublicResults(v).length);}
});
test('duplicate/missing/foreign result cohorts and invented statistics remain invalid',()=>{
 for(const tamper of [v=>v.results.push(v.results[0]),v=>v.rows.pop(),v=>v.body[0].pid=401,v=>v.results[0].id='foreign',v=>v.stats.expected=1,v=>v.results[0].retry=1,v=>v.signal='SIGABRT',v=>v.code=137]){const v=fixture();tamper(v);assert.ok(validatePublicResults(v).length);}
});
test('static closure compares both file names and values; absent or added inputs do not silently disappear',()=>{
 const expected={'src/a.ts':'a'.repeat(64),'../root.json':'b'.repeat(64)};assert.deepEqual(validatePublicClosure(expected,{...expected}),[]);
 for(const actual of [{'src/a.ts':expected['src/a.ts']},{...expected,'unexpected.ts':'c'.repeat(64)},{...expected,'src/a.ts':'0'.repeat(64)}])assert.ok(validatePublicClosure(expected,actual).length);
});
test('a passed result with a hidden singular error cannot become a clean fixture proof',()=>{const value=fixture();value.results[0].error={message:'controlled hidden singular failure',cause:{message:'technical nested failure'}};assert.ok(validatePublicResults(value).length);});
test('technical counter cleanup preserves Error and primitive causes behind a fixed invalid marker',async()=>{for(const cause of [undefined,new Error('controlled close failure')])await assert.rejects(runCounterTechnicalCleanup(()=>{throw cause;}),error=>error.message==='READER_PUBLIC_PROOF_INVALID: counter fixture cleanup'&&Object.hasOwn(error,'cause')&&error.cause===cause);});
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {realpathSync,readdirSync,existsSync} from 'node:fs';
const publicCLI=fileURLToPath(new URL('../../scripts/run-reader-public-regressions.mjs',import.meta.url));
for(const alias of [...new Set([publicCLI,publicCLI.replace(/^\/private\/var\//,'/var/')])])test('actual CLI rejects Native before any child/profile without a lease via '+alias,()=>{
 const env={...process.env};delete env.READER_PUBLIC_NATIVE_SLOT;const reports=new URL('../../reports/reader-public-regressions',import.meta.url),before=existsSync(reports)?readdirSync(reports):[];
 const child=spawnSync(process.execPath,[alias,'--scope','browser8','--native'],{cwd:fileURLToPath(new URL('../..',import.meta.url)),env,encoding:'utf8',timeout:5000});
 assert.equal(child.status,2);assert.equal(child.signal,null);assert.match(child.stderr,/explicit Root Native lease required/);assert.deepEqual(existsSync(reports)?readdirSync(reports):[],before);
});
test('an absent explicit workspace refuses CPU preparation before a compiler or browser starts',()=>{
 const child=spawnSync(process.execPath,[realpathSync(publicCLI),'--scope','browser8','--build-only'],{cwd:fileURLToPath(new URL('../..',import.meta.url)),env:{...process.env,READER_PUBLIC_WORKSPACE_ROOT:'/__controlled_absent_reader_workspace__'},encoding:'utf8',timeout:5000});assert.equal(child.status,2);assert.equal(child.signal,null);assert.match(child.stderr,/READER_PUBLIC_PROOF_INVALID: setup.*ENOENT/);
});
test('matching plain Source markers never admit a foreign or absent global baseline selector',()=>{for(const globalActive of ['foreign',0,undefined]){const value=fixture();value.rows[0].globalActive=globalActive;assert.ok(validatePublicResults(value).length);}});
