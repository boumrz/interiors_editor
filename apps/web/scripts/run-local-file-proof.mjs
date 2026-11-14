import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const scope=process.env.LOCAL_FILE_PROOF_SCOPE,phase=process.env.LOCAL_FILE_PROOF_PHASE??'full',id=process.env.__STRYKER_ACTIVE_MUTANT__??null;
if(!['file','hash'].includes(scope)||!/^[a-z0-9_-]+$/i.test(phase)||(id!==null&&!/^\d+$/.test(id)))throw new Error('Invalid owned scope/phase/id');
const plans={file:['src/ui/local-file-transfer.test.tsx'],hash:['src/ui/local-glb-resource.test.tsx']};
const subjects=['src/ui/local-file-transfer.tsx','src/ui/local-glb-resource.ts'];
const root=resolve('reports/local-file-proof',scope,phase,id??'baseline');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'call-'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sources=Object.fromEntries(await Promise.all(subjects.map(async f=>[f,sha(await readFile(f))])));
const targets=scope==='file'?subjects.slice(0,1):subjects.slice(1),selected=[];
for(const file of targets)if(/function\s+stryNS_[A-Za-z0-9_$]+\s*\(/.test(await readFile(file,'utf8')))selected.push(file);
if(id!==null&&selected.length!==targets.length)throw new Error('Numeric selector requires every actual instrumented subject');
const expected={...sources};if(process.env.LOCAL_FILE_PROOF_POISON_SOURCE==='1')expected[subjects[0]]='0'.repeat(64);
const lease=join(directory,'worker-lease.json');if(process.env.LOCAL_FILE_PROOF_POISON_WORKER==='1')await writeFile(lease,JSON.stringify({pid:-1,testId:'foreign'}));
const record={scope,phase,id,directory,sources,selected,state:'started',issues:[]};await writeFile(join(directory,'run.json'),JSON.stringify(record,null,2));
const child=spawn(process.execPath,['node_modules/@rstest/core/bin/rstest.js','run','--config','rstest.local-file-proof.config.mjs','--pool.maxWorkers','1'],{env:{...process.env,LOCAL_FILE_PROOF_INVOCATION:directory,LOCAL_FILE_PROOF_SOURCE_SHAS:JSON.stringify(expected),LOCAL_FILE_PROOF_SELECTED:JSON.stringify(selected),LOCAL_FILE_PROOF_TEST_FILES:JSON.stringify(plans[scope]),LOCAL_FILE_PROOF_WORKER_LEASE:lease},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',bytes=>output+=bytes);child.stderr.on('data',bytes=>output+=bytes);const outcome=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});await writeFile(join(directory,'output.log'),output);
try{
 const report=JSON.parse(await readFile(join(directory,'report.json'),'utf8')),rows=(await readFile(join(directory,'activation.jsonl'),'utf8')).split('\n').filter(Boolean).map(JSON.parse),tests=report.files.flatMap(file=>file.results??[]),failed=tests.filter(test=>test.status==='fail'),count=scope==='file'?8:7;
 const subtype=/(?:test|hook) timed out in\s+\d+\s*ms|Timeout - Async callback|Exceeded timeout/i;
 const bodyTimeouts=tests.flatMap(test=>(test.errors??[]).filter(error=>subtype.test(error.message??'')).map(error=>({testId:test.testId,name:test.fullName,message:error.message})));
 if(bodyTimeouts.length)record.issues.push('body-timeout-subtype');
 if(report.unhandledErrors?.length||report.files.some(file=>file.errors?.length))record.issues.push('unhandled-global-or-file-error');
 if(/Build errors?:|unable to locate|Module not found|Cannot find module|\bERROR in\b|LOCAL_FILE_PROOF_PROOF_INVALID|LOCAL_FILE_PROOF_WORKER_OWNER_INVALID/.test(output))record.issues.push('compiler-or-proof-setup-error');
 if(report.summary?.testFiles!==plans[scope].length||report.summary?.tests!==count||tests.length!==count||report.summary?.skippedTests!==0||report.summary?.todoTests!==0||tests.some(test=>!['pass','fail'].includes(test.status)||test.retryCount!==0))record.issues.push('not-complete-frozen-corpus');
 const marked=new Map(rows.filter(row=>row.valid).map(row=>[row.testId,row]));
 if(rows.length!==count||marked.size!==count||rows.some(row=>!row.valid||row.id!==id)||tests.some(test=>!marked.has(test.testId)))record.issues.push('not-all-actual-case-source-probes');
 for(const row of rows)for(const file of subjects){const value=row.observations?.[file];if(!value||value.loadedSHA!==sources[file]||(selected.includes(file)?(value.active!==id||(id!==null&&!value.instrumented)):(value.instrumented||value.active!==null)))record.issues.push('actual-module-source-or-local-ID');}
 if(outcome.signal!==null||![0,1].includes(outcome.code))record.issues.push('abnormal-child');
 if(outcome.code===0&&(report.summary?.passedTests!==count||report.summary?.failedTests!==0||failed.length))record.issues.push('unclean-success');
 if(outcome.code!==0&&(!(report.summary?.failedTests>0)||!failed.length||failed.some(test=>!marked.has(test.testId))))record.issues.push('no-real-marked-named-failure');
 const identities=tests.map(test=>({id:test.testId,file:test.testPath,name:test.fullName})).sort((a,b)=>a.id.localeCompare(b.id)),identityPath=resolve('reports/local-file-proof',scope,'case-identities.json');
 if(phase==='baseline'&&outcome.code===0&&!record.issues.length)await writeFile(identityPath,JSON.stringify(identities,null,2));else if(phase!=='baseline'&&JSON.stringify(identities)!==JSON.stringify(JSON.parse(await readFile(identityPath,'utf8'))))record.issues.push('case-identity-drift');
 try{await access(lease);record.issues.push('worker-lease-leaked');}catch{}
 record.summary=report.summary;record.bodyTimeouts=bodyTimeouts;record.failedTestIDs=failed.map(test=>test.testId);record.observations=rows.length;
}catch(error){record.issues.push(String(error));}
record.issues=[...new Set(record.issues)];record.outcome=outcome;record.state=record.issues.length?'invalid-infrastructure':outcome.code===0?'all-clean':'behavior-failed';await writeFile(join(directory,'run.json'),JSON.stringify(record,null,2));process.stdout.write(JSON.stringify(record)+'\n');if(record.issues.length){process.stdout.write(output);process.exitCode=2;}else{if(outcome.code!==0)process.stdout.write(output);process.exitCode=outcome.code;}
