import{resolve}from'node:path';
const body=/test timed out in\s*\d+\s*ms|Timeout - Async callback|Exceeded timeout/i,hook=/hook timed out in\s*\d+\s*ms/i;
export function classifyTmaMetadataPrefix({report,markers,code,signal,active}){
 const issues=[],cases=report.files?.flatMap(file=>file.results??[])??[],counts=report.summary,marks=new Map(markers.map(row=>[row.testId,row])),flatten=error=>Array.isArray(error?.errors)?error.errors.flatMap(flatten):[error];
 const extras=[...(report.unhandledErrors??[]),...(report.files??[]).flatMap(file=>file.errors??[])].flatMap(flatten),failed=cases.filter(test=>test.status==='fail'),errors=failed.flatMap(test=>test.errors??[]).flatMap(flatten);
 if(signal!==null||![0,1].includes(code))issues.push('abnormal-child-exit');if(extras.length)issues.push('file-or-global-extra');if(errors.some(error=>hook.test(error?.message??'')))issues.push('hook-timeout');
 if(!counts||cases.length!==counts.tests||markers.length!==cases.length||marks.size!==markers.length||failed.length!==counts.failedTests||cases.filter(test=>test.status==='pass').length!==counts.passedTests||counts.skippedTests||counts.todoTests)issues.push('incomplete-reported-corpus');
 for(const test of cases){const row=marks.get(test.testId);if(!row?.valid||!test.fullName||!test.testPath||test.fullName!==row.title||resolve(test.testPath)!==resolve(row.file)||!['pass','fail'].includes(test.status)||test.retryCount!==0)issues.push('case-identity-or-activation');}
 if(failed.some(test=>!test.errors?.length))issues.push('failure-without-reported-error');if(code===0&&failed.length||code===1&&!failed.length)issues.push('exit-behavior-mismatch');
 const bodyErrors=errors.filter(error=>body.test(error?.message??''));if(bodyErrors.length&&(typeof active!=='string'||!/^(0|[1-9][0-9]*)$/.test(active)))issues.push('baseline-or-unknown-body-timeout');if(bodyErrors.length&&bodyErrors.length!==errors.length)issues.push('mixed-body-error');
 return{code:issues.length?2:bodyErrors.length?98:code,state:issues.length?'invalid-infrastructure':bodyErrors.length?'inconclusive-body-timeout':code===0?'all-cases-clean':'behavior-failed',issues:[...new Set(issues)],failed,extras};
}
