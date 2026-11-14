import { StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ProjectSourceRecoveryPort, UnverifiedProjectSource } from "../../src/application/ports";
import { prepareUnverifiedSourceFile, StoredSourceRecovery } from "../../src/ui/stored-source-recovery";
import "../../src/ui/global.css";

type Owner = "a" | "b";
type Phase = "list" | "read" | "export";
type Mode = "normal" | "empty" | "list-error" | "read-error" | "stale" | "wrong-project" | "wrong-revision" | "export-error";
let mode: Mode = "normal";
let hold: Phase | undefined;
const releases: (() => void)[] = [];
let changeOwner: ((owner: Owner) => void) | undefined;
let root: Root | undefined;
const calls: { phase: Phase; owner: Owner; projectId?: string; revisionId?: string }[] = [];
const exported: UnverifiedProjectSource[] = [];
const raw = "  \u0000 \ud800 \udfff \ud83d\ude80 \n{future data}\t  ";
async function wait(phase: Phase) { if(hold!==phase)return;hold=undefined;await new Promise<void>(resolve=>{releases.push(resolve);}); }
const ports: Record<Owner,ProjectSourceRecoveryPort> = {
 a: createPort("a"), b: createPort("b"),
};
function createPort(owner: Owner): ProjectSourceRecoveryPort {
 return {
  async listRecoverySources(){calls.push({phase:"list",owner});const selectedMode=mode;await wait("list");if(selectedMode==="list-error")throw new Error("Directory unavailable");return selectedMode==="empty"?[]:[{kind:"unverified-source",projectId:`${owner}-project`,revisionId:`${owner}-revision`}];},
  async readRecoverySource(projectId,revisionId){calls.push({phase:"read",owner,projectId,revisionId});const selectedMode=mode;await wait("read");if(selectedMode==="read-error")throw new Error("Read unavailable");if(selectedMode==="stale")return undefined;return{kind:"unverified-source",projectId:selectedMode==="wrong-project"?"foreign-project":projectId,revisionId:selectedMode==="wrong-revision"?"foreign-revision":revisionId,serializedProject:raw};},
 };
}
function View({strict}:{strict:boolean}) {
 const [owner,setOwner]=useState<Owner>("a");changeOwner=setOwner;
 const panel=<StoredSourceRecovery port={ports[owner]} onExport={async(source)=>{
  calls.push({phase:"export",owner});exported.push(source);const selectedMode=mode;await wait("export");if(selectedMode==="export-error")throw new Error("Preparation unavailable");
  const file=prepareUnverifiedSourceFile(source);if(file.kind!=="prepared-source")throw new Error("Fixture source too large");const decoded=JSON.parse(new TextDecoder().decode(file.bytes));if(decoded.serializedProject!==raw)throw new Error("Source changed");
 }}/>;
 return strict?<StrictMode>{panel}</StrictMode>:panel;
}
const fixture={
 mount(strict=false){const container=document.getElementById("root");if(!container)throw new Error("Missing root");root=createRoot(container);root.render(<View strict={strict}/>);},
 mode(value:Mode){mode=value;},hold(phase:Phase){hold=phase;},release(index=0){releases[index]?.();},switch(owner:Owner){changeOwner?.(owner);},unmount(){root?.unmount();root=undefined;},
 inspect(){return{calls,exported,raw};},
 flush(){return new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));},
};
declare global {interface Window {readonly __storedSourceFixture:typeof fixture}}
Object.defineProperty(window,"__storedSourceFixture",{value:fixture});
