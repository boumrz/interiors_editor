import {expect,test} from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";
// Opaque fixture bytes prove metadata admission only; this is not GLB/render validation.
test("SCOPED-SPARSE-ROOTS: a native sparse root array cannot authorize reading an otherwise exact resource",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
 await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","roots","roots-project","roots-r1",[31,32,33]));
 await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","roots"));
 expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","roots"))).toEqual({kind:"durable"});
 await page.evaluate(()=>window.__telegramProjectHarness.completePrepared("a","roots"));
 expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","roots"))).toEqual([31,32,33]);
 const fault=await page.evaluate(()=>window.__telegramProjectHarness.sparseResourceRoots("a","roots"));
 expect(fault).toEqual({nativeLength:1,nativeOwnKeys:[],durableBefore:true,durableAfter:true});
 const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
 const outcome=await page.evaluate(async()=>{
  try { const bytes=await window.__telegramProjectHarness.resourceBytes("a","roots");return bytes===undefined?{kind:"refused"}:{kind:"read",bytes}; }
  catch { return {kind:"refused"}; }
 });
 expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
 expect(outcome).toEqual({kind:"refused"});
});
