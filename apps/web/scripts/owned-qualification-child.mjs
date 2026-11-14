// External proof lifecycle only. No unverified/reused PID or bare process-group signals.
import {spawn,execFileSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
const canonical=p=>{try{return realpathSync(resolve(p));}catch{return null;}};
const alias=s=>String(s).replaceAll('/private/var/','/var/');
export function processRows(){return execFileSync('/bin/ps',['-axo','pid=,ppid=,pgid=,command='],{encoding:'utf8'}).split('\n').flatMap(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);return m?[{pid:Number(m[1]),ppid:Number(m[2]),pgid:Number(m[3]),command:m[4]}]:[];});}
const sameIdentity=(a,b)=>a?.pid===b.pid&&a.pgid===b.pgid&&a.command===b.command;
function processCwd(pid){try{return execFileSync('/usr/sbin/lsof',['-a','-p',String(pid),'-d','cwd','-Fn'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1000}).split('\n').find(line=>line.startsWith('n'))?.slice(1);}catch{return null;}}
export function currentlyOwnedRows({rows,groupPID,entry,cwd,profiles=[],attested=new Map(),readCwd=processCwd}){
 const program=alias(entry),actualCwd=canonical(cwd),roots=profiles.filter(Boolean).map(root=>alias(root).replace(/\/$/,'')+'/');
 const hasProfile=row=>roots.some(root=>alias(row.command).includes(root));
 return rows.filter(row=>row.pid!==process.pid&&(row.pgid===groupPID||hasProfile(row))).filter(row=>{
  if(sameIdentity(attested.get(row.pid),row))return true;
  if(hasProfile(row))return true;
  // After leader EXIT, the descendant must independently prove its current program,
  // current owned PGID and unique isolated cwd. A numeric PGID alone never suffices.
  return row.pgid===groupPID&&alias(row.command).startsWith(program+' ')&&actualCwd&&canonical(readCwd(row.pid))===actualCwd;
 });
}
function handleOwnership(child,{entry,cwd,profiles=[],forceMs=1500,refusalMs=1000,onRefusal}){
 const attested=new Map(),signals=[],issues=[];
 let lastRows=[],forceTimer,refusalTimer;
 const refresh=()=>{try{const rows=processRows(),owned=currentlyOwnedRows({rows,groupPID:child.pid,entry,cwd,profiles,attested});for(const row of owned)attested.set(row.pid,row);lastRows=rows.filter(row=>row.pgid===child.pid||profiles.some(root=>alias(row.command).includes(alias(root).replace(/\/$/,'')+'/')));return owned;}catch(error){issues.push(String(error));return[];}};
 return {child,attested,signals,issues,refresh,armForce(){if(!forceTimer){forceTimer=setTimeout(()=>this.signal('SIGKILL'),forceMs);refusalTimer=setTimeout(onRefusal,forceMs+refusalMs);}},dispose(){clearTimeout(forceTimer);clearTimeout(refusalTimer);},get remaining(){refresh();return lastRows;},signal(signal){
  const owned=refresh();
  for(const candidate of owned){const fresh=refresh().find(row=>sameIdentity(candidate,row));if(!fresh)continue;try{process.kill(fresh.pid,signal);signals.push({...fresh,signal,at:new Date().toISOString()});}catch(error){if(error.code!=='ESRCH')issues.push(String(error));}}
 }};
}
export function signalOwnedGroup(handle,signal){if(!handle)return;if(signal==='SIGTERM')handle.armForce();handle.signal(signal);}
function awaitClose(child){return new Promise(resolve=>{let spawnError=null;child.once('error',error=>{spawnError=String(error);});child.once('close',(code,signal)=>resolve({code,signal,spawnError,closed:true}));});}
export async function runOwnedChild({entry=process.execPath,args,cwd,env,stop,timeoutMs=300000,forceMs=1500,refusalMs=1000,ownedProfileRoots=[]}){
 stop.assertCanStart();const child=spawn(entry,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});let text='',timedOut=false,leaderExit=null,closedObserved=false,pipeAbandonment=false,resolveRefusal;
 const refusal=new Promise(resolve=>{resolveRefusal=resolve;});
 const onRefusal=()=>{if(closedObserved)return;pipeAbandonment=true;stop.request('unproven-close-refusal');ownership.issues.push('unproven-close-refusal');child.stdout?.destroy();child.stderr?.destroy();child.unref();resolveRefusal({closed:false,code:leaderExit?.code??null,signal:leaderExit?.signal??null,spawnError:null,pipeAbandonment:true,refusalReason:'CLOSE unproven after owned signal grace; only parent pipe handles disposed'});};
 const ownership=handleOwnership(child,{entry,cwd,profiles:ownedProfileRoots,forceMs,refusalMs,onRefusal}),record={pid:child.pid,pgid:child.pid,closed:false,startedUTC:new Date().toISOString()};stop.current=ownership;
 const closed=awaitClose(child).then(result=>{if(pipeAbandonment)return{...result,closed:false,pipeAbandonment:true,closeAfterPipeDisposal:true};closedObserved=true;return result;});
 child.once('exit',(code,signal)=>{leaderExit={code,signal,at:new Date().toISOString()};ownership.refresh();});
 for(const stream of [child.stdout,child.stderr]){stream?.on('data',bytes=>text+=bytes);stream?.on('error',error=>ownership.issues.push('owned-pipe-error:'+String(error)));}
 const timer=setTimeout(()=>{timedOut=true;stop.request('outer-timeout');signalOwnedGroup(ownership,'SIGTERM');},timeoutMs);
 try{Object.assign(record,await Promise.race([closed,refusal]),{timedOut,leaderExit,endedUTC:new Date().toISOString()});let remaining=ownership.remaining;const deadline=performance.now()+1000;while(record.closed&&remaining.length&&performance.now()<deadline){await new Promise(resolve=>setTimeout(resolve,20));remaining=ownership.remaining;}return{...record,text,ownership:{attested:[...ownership.attested.values()],signals:ownership.signals,issues:ownership.issues,remaining}};}
 finally{clearTimeout(timer);ownership.dispose();if(stop.current===ownership)stop.current=null;}
}
