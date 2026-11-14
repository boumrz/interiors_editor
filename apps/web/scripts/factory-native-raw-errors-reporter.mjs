// Reporter runs in the actual Playwright CLI. Serialize only documented identity/error fields.
import{writeFileSync,appendFileSync}from'node:fs';import{readFormatterBinding}from'./factory-native-error-binding.mjs';
export default class FactoryNativeRawErrorsReporter{
 constructor(){this.file=process.env.FACTORY_NATIVE_RAW_ERRORS_LEDGER;if(!this.file)throw Error('FACTORY_RAW_ERRORS_INVALID: explicit owned ledger required');this.cliPid=process.pid;this.binding=readFormatterBinding();writeFileSync(this.file,'',{flag:'wx'});writeFileSync(this.file+'.meta.json',JSON.stringify({cliPid:this.cliPid,formatterBinding:this.binding}));}
 onTestEnd(test,result){try{const record={version:1,cliPid:this.cliPid,testId:test.id,file:test.location.file,line:test.location.line,column:test.location.column,title:test.title,titlePath:test.titlePath(),expectedStatus:test.expectedStatus,status:result.status,retry:result.retry,workerIndex:result.workerIndex,parallelIndex:result.parallelIndex,errors:result.errors};appendFileSync(this.file,JSON.stringify(record)+'\n');}catch(cause){throw Error('FACTORY_RAW_ERRORS_INVALID: raw reporter serialization failed',{cause});}}
 onEnd(result){writeFileSync(this.file+'.terminal.json',JSON.stringify({cliPid:this.cliPid,status:result.status,formatterBinding:readFormatterBinding()}));}
}
