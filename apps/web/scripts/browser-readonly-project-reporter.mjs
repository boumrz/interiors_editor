import {appendFileSync} from 'node:fs';
const prefix='BROWSER_READONLY_ACTIVATION ';
export default class BrowserReadonlyReporter {
 buffer='';
 onStdOut(chunk){this.buffer+=String(chunk);let end;while((end=this.buffer.indexOf('\n'))!==-1){const line=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end+1);if(line.startsWith(prefix)){const row=JSON.parse(line.slice(prefix.length));appendFileSync(process.env.BROWSER_READONLY_LEDGER,JSON.stringify({phase:'before',...row})+'\n');}}}
 onTestEnd(test,result){appendFileSync(process.env.BROWSER_READONLY_LEDGER,JSON.stringify({phase:'completion',title:test.title,status:result.status,expectedStatus:test.expectedStatus,errors:result.errors.length})+'\n');}
}
