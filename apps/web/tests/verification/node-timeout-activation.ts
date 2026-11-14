import { beforeEach, afterEach } from "@rstest/core";
import "../../src/adapters/persistence/indexeddb-custom-asset-resource-store";
import "../../src/adapters/portable-backup/browser-registered-project-exporter";
import "../../src/app/project-controller";
import "../../src/app/registered-project-controller";
const runtime = Reflect.get(globalThis, "process"), env = runtime.env;
const leases = new Set<string>();
beforeEach(async context => {
 const fsName="node:fs", fs=await import(fsName), expected=JSON.parse(env.NODE_TIMEOUT_SOURCE_SHAS), selected=JSON.parse(env.NODE_TIMEOUT_SELECTED), id=env.NODE_TIMEOUT_POISON_ID==="1"?"wrong-active-control":Reflect.get(env,"__STRYKER_ACTIVE_MUTANT__")??null, markers=Reflect.get(globalThis,"__NODE_TIMEOUT_SUBJECTS__");
 const observations=Object.fromEntries(Object.entries(expected).map(([file,sha])=>{const marker=markers?.[file];return[file,{expectedSHA:sha,loadedSHA:marker?.sha,instrumented:marker?.instrumented,active:marker?.readActive()}];}));
 const issues:string[]=[];
 for(const [file,value]of Object.entries(observations)){
  const item=value as {expectedSHA:string;loadedSHA?:string;instrumented?:boolean;active?:unknown};
  if(item.expectedSHA!==item.loadedSHA||(selected.includes(file)?(item.active!==id||(id!==null&&!item.instrumented)):(item.instrumented||item.active!==null)))issues.push(file);
 }
 const testId=context.task.id,key=JSON.stringify([context.task.filepath,context.task.name]);
 if(!issues.length){try{const handle=fs.openSync(env.NODE_TIMEOUT_WORKER_LEASE,"wx");fs.writeFileSync(handle,JSON.stringify({pid:runtime.pid,testId,key}));fs.closeSync(handle);leases.add(testId);}catch{issues.push("exclusive-worker-admission");}}
 const row={testId,key,pid:runtime.pid,id,observations,valid:issues.length===0,issues};
 fs.appendFileSync(env.NODE_TIMEOUT_INVOCATION+"/activation.jsonl",JSON.stringify(row)+"\n");
 if(issues.length)throw new Error("NODE_TIMEOUT_PROOF_INVALID");
});
afterEach(async context=>{if(!leases.delete(context.task.id))return;const name="node:fs",fs=await import(name);const current=JSON.parse(fs.readFileSync(env.NODE_TIMEOUT_WORKER_LEASE,"utf8"));if(current.pid!==runtime.pid||current.testId!==context.task.id)throw new Error("NODE_TIMEOUT_WORKER_OWNER_INVALID");fs.unlinkSync(env.NODE_TIMEOUT_WORKER_LEASE);});
