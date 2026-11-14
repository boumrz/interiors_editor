import { beforeEach, afterEach } from "@rstest/core";
import "../../src/ui/local-file-transfer";
import "../../src/ui/local-glb-resource";
const runtime = Reflect.get(globalThis, "process"), env = runtime.env;
const leases = new Set<string>();
beforeEach(async context => {
 const fsName="node:fs", fs=await import(fsName), expected=JSON.parse(env.LOCAL_FILE_PROOF_SOURCE_SHAS), selected=JSON.parse(env.LOCAL_FILE_PROOF_SELECTED), id=env.LOCAL_FILE_PROOF_POISON_ID==="1"?"wrong-active-control":Reflect.get(env,"__STRYKER_ACTIVE_MUTANT__")??null, markers=Reflect.get(globalThis,"__LOCAL_FILE_PROOF_SUBJECTS__");
 const observations=Object.fromEntries(Object.entries(expected).map(([file,sha])=>{const marker=markers?.[file];return[file,{expectedSHA:sha,loadedSHA:marker?.sha,instrumented:marker?.instrumented,active:marker?.readActive()}];}));
 const issues:string[]=[];
 for(const [file,value]of Object.entries(observations)){
  const item=value as {expectedSHA:string;loadedSHA?:string;instrumented?:boolean;active?:unknown};
  if(item.expectedSHA!==item.loadedSHA||(selected.includes(file)?(item.active!==id||(id!==null&&!item.instrumented)):(item.instrumented||item.active!==null)))issues.push(file);
 }
 const testId=context.task.id,key=JSON.stringify([context.task.filepath,context.task.name]);
 if(!issues.length){try{const handle=fs.openSync(env.LOCAL_FILE_PROOF_WORKER_LEASE,"wx");fs.writeFileSync(handle,JSON.stringify({pid:runtime.pid,testId,key}));fs.closeSync(handle);leases.add(testId);}catch{issues.push("exclusive-worker-admission");}}
 const row={testId,key,pid:runtime.pid,id,observations,valid:issues.length===0,issues};
 fs.appendFileSync(`${env.LOCAL_FILE_PROOF_INVOCATION}/activation.jsonl`,`${JSON.stringify(row)}\n`);
 if(issues.length)throw new Error("LOCAL_FILE_PROOF_PROOF_INVALID");
});
afterEach(async context=>{if(!leases.delete(context.task.id))return;const name="node:fs",fs=await import(name);const current=JSON.parse(fs.readFileSync(env.LOCAL_FILE_PROOF_WORKER_LEASE,"utf8"));if(current.pid!==runtime.pid||current.testId!==context.task.id)throw new Error("LOCAL_FILE_PROOF_WORKER_OWNER_INVALID");fs.unlinkSync(env.LOCAL_FILE_PROOF_WORKER_LEASE);});
