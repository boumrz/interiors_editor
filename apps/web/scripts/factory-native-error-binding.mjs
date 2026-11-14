// Verification only: exact pinned reporter serialization; never parse stack frames from message.
import{readFileSync,realpathSync}from'node:fs';import{createHash}from'node:crypto';import{createRequire}from'node:module';import{dirname,join,resolve}from'node:path';
const require=createRequire(import.meta.url),pkg=require.resolve('playwright/package.json',{paths:[dirname(require.resolve('@playwright/test/package.json'))]}),root=dirname(pkg),runner=join(root,'lib/runner/index.js'),base=require(runner).base;
if(JSON.parse(readFileSync(pkg,'utf8')).version!=='1.62.1')throw Error('FACTORY_RAW_ERRORS_INVALID: unsupported pinned formatter');
export const formatReportedError=error=>base.formatError(base.nonTerminalScreen,error);
export function readFormatterBinding(){return Object.fromEntries([pkg,runner].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));}
export const formatterBinding=readFormatterBinding();
const sorted=v=>Array.isArray(v)?v.map(x=>x===undefined?null:sorted(x)):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sorted(v[k])])):v;
export const canonicalJSON=v=>JSON.stringify(sorted(v));
const canonical=p=>{try{return realpathSync(resolve(p));}catch{return resolve(p).replace(/^\/private\/var\//,'/var/');}},positive=n=>Number.isSafeInteger(n)&&n>0;
function validError(e,depth=0){if(depth>16||!e||typeof e!=='object'||Array.isArray(e)||['message','stack'].some(k=>Object.hasOwn(e,k)&&typeof e[k]!=='string')||![e.message,e.stack].some(v=>typeof v==='string'&&v.trim()))return false;if(Object.hasOwn(e,'errors')&&(!Array.isArray(e.errors)||!e.errors.length||e.errors.some(x=>!validError(x,depth+1))))return false;return!Object.hasOwn(e,'cause')||validError(e.cause,depth+1);}
export function bindFactoryNativeErrors({report,rawErrors,expectedCliPid,expectedFormatterBinding=formatterBinding,actualFormatterBinding=readFormatterBinding()}){
 const issues=[],check=(v,m)=>{if(!v)issues.push(m);};try{
 check(positive(expectedCliPid)&&Array.isArray(rawErrors),'raw-reporter-shape');check(canonicalJSON(expectedFormatterBinding)===canonicalJSON(actualFormatterBinding)&&canonicalJSON(expectedFormatterBinding)===canonicalJSON(formatterBinding),'formatter-dependency-drift');
 const phaseReport=structuredClone(report),entries=[];function walk(s){for(const spec of s.specs??[])for(const t of spec.tests??[])for(const result of t.results??[])entries.push({spec,t,result});for(const child of s.suites??[])walk(child);}walk(phaseReport);const consumed=new Set();
 for(const {spec,t,result}of entries){const matches=rawErrors.map((r,i)=>({r,i})).filter(({r})=>r.testId===spec.id&&r.retry===result.retry);check(matches.length===1,'raw-result-bijection');if(matches.length!==1)continue;const{r,i}=matches[0];consumed.add(i);check(r.version===1&&r.cliPid===expectedCliPid&&canonical(r.file)===canonical(resolve(report.config.rootDir,spec.file))&&r.title===spec.title&&r.line===spec.line&&r.column===spec.column&&Array.isArray(r.titlePath)&&r.titlePath.every(v=>typeof v==='string')&&r.titlePath.at(-1)===spec.title&&r.expectedStatus===t.expectedStatus&&r.status===result.status&&r.retry===0&&r.workerIndex===result.workerIndex&&r.parallelIndex===result.parallelIndex,'raw-owning-spec/CLI-identity');
 check(Array.isArray(r.errors)&&r.errors.every(e=>validError(e))&&Array.isArray(result.errors),'raw-error-payload');if(!Array.isArray(r.errors)||!r.errors.every(e=>validError(e))||!Array.isArray(result.errors))continue;
 const formatted=r.errors.map(formatReportedError);check(canonicalJSON(formatted)===canonicalJSON(result.errors),'raw-formatted-exact-bijection');if(Object.hasOwn(result,'error'))check(r.errors.length>0&&canonicalJSON(result.error)===canonicalJSON(r.errors[0]),'raw-first-error-agreement');else check(r.errors.length===0,'missing-raw-first-error');
 check(result.status==='passed'?r.errors.length===0:result.status==='failed'?r.errors.length>0:result.status==='skipped'&&r.errors.length===0,'raw-result-status/payload');
 // The original JSON report remains on disk. Only this validated derived phase gets raw errors.
 result.errors=structuredClone(r.errors);
 }
 check(consumed.size===rawErrors.length&&entries.length===rawErrors.length,'orphan-or-duplicate-raw-reporter-record');return{valid:issues.length===0,issues:[...new Set(issues)],phaseReport:issues.length?null:phaseReport,records:rawErrors.length,formatterBinding:actualFormatterBinding};
 }catch(error){return{valid:false,issues:[...new Set([...issues,'malformed-raw-error-binding:'+String(error)])],phaseReport:null};}
}
