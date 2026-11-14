// Verification only: distinguish behavioral detection from invalid native setup.
const flatten=suites=>suites.flatMap(suite=>[...(suite.specs??[]),...flatten(suite.suites??[])]);
const clean=value=>String(value??'').replace(/\u001b\[[0-9;]*m/g,'');
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
export function qualifyScopedNativeResult({run,report,rows,output='',expectedCases}){
 const issues=[],specs=flatten(report.suites??[]),expected=new Map(expectedCases.map(spec=>[spec.id,spec]));
 const allResults=specs.flatMap(spec=>spec.tests.flatMap(test=>test.results.map(result=>({spec,result}))));
 const failed=allResults.filter(({result})=>result.status==='failed');
 const passed=allResults.filter(({result})=>result.status==='passed');
 const observations=new Set(rows.map(row=>row.testId));
 if(run.state!=='native-completed'||run.signal!==null||![0,1].includes(run.code))issues.push('native-not-completed');
 if(/Build errors:|unable to locate|Module not found|Cannot find module|\bERROR in\b|SCOPED_SETUP_BUILD_FAILED|SCOPED_SUBJECT_ACTIVATION_INVALID|SCOPED_SUBJECT_NAVIGATION_INVALID|SCOPED_PROOF_LEDGER_IO_INVALID/.test(clean(output)))issues.push('build-setup-or-activation-error');
 if(specs.length!==expected.size||new Set(specs.map(spec=>spec.id)).size!==expected.size||specs.some(spec=>!expected.has(spec.id)||expected.get(spec.id).title!==spec.title))issues.push('discovered-corpus-mismatch');
 if(report.stats.flaky!==0||allResults.some(({result})=>!['passed','failed'].includes(result.status)||result.retry!==0))issues.push('retry-timeout-or-nonbehavior-result');
 if(rows.length===0||rows.some(row=>!row.valid||row.id!==(run.id==='baseline'?null:run.id)||!expected.has(row.testId)||!same(row.expectedSources,run.expectedSources)||!same(row.selected,run.selected)))issues.push('invalid-case-activation');
 for(const row of rows){
  const id=run.id==='baseline'?null:run.id;
  if(row.actual?.html!==id||Object.entries(run.expectedSources).some(([name,sha])=>{
   const subject=row.actual?.modules?.[name];return !subject||subject.sha!==sha||(run.selected.includes(name)?(subject.active!==id||(id!==null&&!subject.instrumented)):(subject.active!==null||subject.instrumented));
  })){issues.push('invalid-actual-module-source-or-local-selector');break;}
 }
 if(allResults.some(({spec})=>!observations.has(spec.id)))issues.push('executed-case-without-subject-proof');
 const canonical='Testing stopped early after 1 maximum allowed failures.';
 if((report.errors??[]).some(error=>!(failed.length===1&&clean(error.message)===canonical)))issues.push('native-global-error');
 if(run.code===0){
  if(report.stats.expected!==expected.size||report.stats.unexpected!==0||report.stats.skipped!==0||failed.length!==0||passed.length!==expected.size||observations.size!==expected.size)issues.push('success-without-complete-clean-corpus');
 }else if(failed.length!==1||report.stats.unexpected!==1)issues.push('failure-without-one-activated-behavioral-result');
 return{state:issues.length?'invalid-infrastructure':run.code===0?'all-cases-clean':'behavior-failed',issues:[...new Set(issues)],cases:expected.size,observedCases:observations.size,observations:rows.length,failed:failed.map(({spec})=>({id:spec.id,title:spec.title}))};
}
export function scopedCasePlan(report){return flatten(report.suites).map(({id,title,file,line,column})=>({id,title,file,line,column}));}
