import {expect,test} from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";
// Actual native ownership/CAS proof with opaque bytes; no GLB validation or signed identity claim.
for(const operation of ["write-pinned","register-library"]as const)for(const field of["version","creationLeaseId","roots","durable"]as const){
 test(`SCOPED-CAS-${operation}-${field}: exact stored metadata must still match after actual Blob verification`,async({page})=>{
  await page.goto("/");await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
  await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","base","cas-base","base-r1",[41,42,43]));
  expect(await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","base"))).toEqual({kind:"stored"});
  expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","base"))).toEqual({kind:"durable"});
  await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","incoming","cas-incoming","incoming-r1",[41,42,43]));
  if(operation==="write-pinned")expect(await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","incoming"))).toEqual({kind:"already-present"});
  else expect((await page.evaluate(()=>window.__telegramProjectHarness.registerPreparedLibrary("a","incoming"))).kind).toBe("registered");
  await page.evaluate(field=>window.__telegramProjectHarness.armResourceCAS("a","a","incoming",field),field);
  const result=await page.evaluate(async operation=>{try{const value=operation==="write-pinned"?await window.__telegramProjectHarness.writePrepared("a","incoming"):await window.__telegramProjectHarness.registerPreparedLibrary("a","incoming");return{kind:"resolved",value};}catch{return{kind:"rejected"};}},operation);
  const proof=await page.evaluate(()=>window.__telegramProjectHarness.resourceCASProof("incoming"));
  expect(proof).toMatchObject({field,digestCalls:2,digestMatches:true});if(!proof)throw new Error("Missing actual digest boundary proof");expect(proof.after).not.toEqual(proof.before);
  expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(proof.afterFaultSnapshot);
  expect(result).toEqual({kind:"rejected"});
  expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","base"))).toEqual([41,42,43]);
 });
}
