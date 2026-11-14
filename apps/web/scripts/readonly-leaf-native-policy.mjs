// Verification only: real mounted-leaf reports must prove the actual module.
const flatten=suites=>suites.flatMap(suite=>[...(suite.specs??[]),...flatten(suite.suites??[])]);
const clean=value=>String(value??'').replace(/\u001b\[[0-9;]*m/g,'');
export function readonlyLeafNativeCasePlan(report){return flatten(report.suites).map(({id,title})=>({id,title}));}
export function qualifyReadonlyLeafNative({report,observations,outcome,sourceSHA,expectedId,expectedCases,output=''}){
 const issues=[],specs=flatten(report.suites??[]),expected=new Map(expectedCases.map(value=>[value.id,value])),executed=specs.flatMap(spec=>spec.tests.flatMap(test=>test.results.map(result=>({spec,result})))),failed=executed.filter(({result})=>result.status==='failed'),passed=executed.filter(({result})=>result.status==='passed'),observed=new Set(observations.map(row=>row.testId));
 if(expected.size!==8||specs.length!==8||new Set(specs.map(value=>value.id)).size!==8||specs.some(spec=>expected.get(spec.id)?.title!==spec.title))issues.push('native-corpus-not-exact8');
 if(observations.length===0||observations.some(row=>!expected.has(row.testId)||row.sha!==sourceSHA||row.active!==expectedId||row.html!==expectedId||(expectedId!==null&&!row.instrumented)))issues.push('actual-module-source-or-selector');
 if(executed.some(({spec})=>!observed.has(spec.id)))issues.push('executed-case-not-activated');
 if(executed.some(({result})=>!['passed','failed'].includes(result.status)||result.retry!==0)||report.stats.flaky!==0)issues.push('retry-timeout-or-nonbehavior-result');
 const actualFailure=expectedId!==null&&failed.length===1&&observed.has(failed[0].spec.id)&&!issues.length;
 if((report.errors??[]).some(error=>!(actualFailure&&clean(error.message)==='Testing stopped early after 1 maximum allowed failures.')))issues.push('unrelated-native-global-error');
 if(/Build errors:|unable to locate|Module not found|Cannot find module|\bERROR in\b|READONLY_LEAF_(?:SOURCE|ACTIVATION)_INVALID/.test(clean(output)))issues.push('compiler-or-activation-error');
 if(outcome.signal!==null||![0,1].includes(outcome.code))issues.push('native-child-not-completed');
 if(outcome.code===0){if(report.stats.expected!==8||report.stats.unexpected!==0||report.stats.skipped!==0||passed.length!==8||failed.length||observed.size!==8||observations.length!==8)issues.push('success-not-all8-clean');}
 else if(failed.length!==1||report.stats.unexpected!==1)issues.push('failure-not-one-activated-assertion');
 return{state:issues.length?'invalid-infrastructure':outcome.code===0?'all8-clean':'behavior-failed',issues:[...new Set(issues)],observations:observations.length,observedCases:observed.size,failed:failed.map(({spec})=>({id:spec.id,title:spec.title}))};
}
