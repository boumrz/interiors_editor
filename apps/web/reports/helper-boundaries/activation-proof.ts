import { beforeEach, expect } from "@rstest/core";
beforeEach(async () => {
 const runtime:unknown=Reflect.get(globalThis,"process");
 const env:unknown=runtime&&typeof runtime==="object"?Reflect.get(runtime,"env"):undefined;
 const expected:unknown=env&&typeof env==="object"?Reflect.get(env,"__STRYKER_ACTIVE_MUTANT__"):undefined;
 if(expected===undefined)return;
 const namespace:unknown=Reflect.get(globalThis,"__stryker__");
 const actual:unknown=namespace&&typeof namespace==="object"?Reflect.get(namespace,"activeMutant"):undefined;
 const root:unknown=env&&typeof env==="object"?Reflect.get(env,"INTERIORS_HELPER_BOUNDARY_ACTIVATION_ROOT"):undefined;
 if(typeof root!=="string")throw new Error("Missing isolated activation journal");
 const fsModule="node:fs/promises";
 const fs:{appendFile(path:string,value:string):Promise<void>}=await import(fsModule);
 await fs.appendFile(`${root}/activation-${String(expected)}.jsonl`,`${JSON.stringify({expected,actual})}\n`);
 expect(actual).toBe(expected);
});
