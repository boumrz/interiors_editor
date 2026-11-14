import{execFile}from'node:child_process';import{promisify}from'node:util';
import{mkdtemp}from'node:fs/promises';
const canonical=value=>String(value).replaceAll('/private/var/','/var/');
// Chrome's Unix singleton socket has a 104-byte path budget on macOS. Keep
// transient profiles out of potentially long workspace/report paths.
export const createReadonlyNativeTemporary=()=>mkdtemp('/tmp/interiors-tma-ro-');
export function readonlyOwnedProcesses(text,{runRoot,pids=[],temporaryRoot}){const prefixes=[canonical(runRoot)+'/tmp/',...(temporaryRoot?[canonical(temporaryRoot)+'/']:[])],known=new Set(pids.filter(Number.isSafeInteger));return text.split('\n').map(line=>{const match=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);return match?{pid:Number(match[1]),ppid:Number(match[2]),pgid:Number(match[3]),command:match[4]}:null;}).filter(row=>row&&(known.has(row.pid)||prefixes.some(prefix=>canonical(row.command).includes(prefix))));}
export async function scanReadonlyTerminal(runRoot,pids,{temporaryRoot}={}){const{stdout}=await promisify(execFile)('/bin/ps',['-axo','pid=,ppid=,pgid=,command=']);return{runRoot,pids,temporaryRoot,remaining:readonlyOwnedProcesses(stdout,{runRoot,pids,temporaryRoot}),observedAt:new Date().toISOString()};}
