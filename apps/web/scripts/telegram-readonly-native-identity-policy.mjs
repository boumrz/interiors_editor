import{resolve}from'node:path';
export function readonlySpecs(report){const walk=ss=>ss.flatMap(s=>[...(s.specs??[]),...walk(s.suites??[])]);return walk(report.suites??[]);}
const fileOf=(file,testDir)=>resolve(testDir,file);
export function readonlyCasePlan(report,testDir){return readonlySpecs(report).map(spec=>({id:spec.id,title:spec.title,file:fileOf(spec.file,testDir)}));}
export function auditReadonlyIdentities({report,activations,plan,testDir,workerEvents}){
 const specs=readonlySpecs(report),expected=new Map(plan.map(row=>[row.id,row]));
 if(plan.length!==67||expected.size!==67||plan.some(row=>typeof row.id!=='string'||!row.id||!row.title||!row.file))throw Error('READONLY_PROOF_INVALID: frozen67 actual identities required');
 if(specs.length!==67||new Set(specs.map(spec=>spec.id)).size!==67||specs.some(spec=>{const row=expected.get(spec.id);return !row||row.title!==spec.title||row.file!==fileOf(spec.file,testDir);}))throw Error('READONLY_PROOF_INVALID: discovered identity corpus differs');
 const started=[];for(const spec of specs)for(const test of spec.tests??[])for(const result of test.results??[]){if(result.retry!==0)throw Error('READONLY_PROOF_INVALID: retry');started.push({spec,result});}
 const failed=started.filter(row=>row.result.status==='failed').length,passed=started.filter(row=>row.result.status==='passed').length;if(report.stats?.flaky!==0||report.stats?.unexpected!==failed||report.stats?.expected!==passed||report.stats?.skipped!==67-started.length||failed>1)throw Error('READONLY_PROOF_INVALID: actual result statistics');
 if(started.length!==activations.length||new Set(started.map(row=>row.spec.id)).size!==started.length)throw Error('READONLY_PROOF_INVALID: duplicate or missing executed case');
 const pids=new Set(workerEvents.filter(event=>event.kind==='begin').map(event=>Number(String(event.owner).split(':')[0])));
 for(let index=0;index<started.length;index++){const{spec}=started[index],row=activations[index];if(row.testId!==spec.id||row.title!==spec.title||resolve(row.file)!==fileOf(spec.file,testDir)||!Number.isSafeInteger(row.pid)||!pids.has(row.pid))throw Error('READONLY_PROOF_INVALID: attachment testId/file/worker mismatch');}
 return {started:started.map(({spec})=>({id:spec.id,title:spec.title,file:fileOf(spec.file,testDir)})),discovered:67};
}
