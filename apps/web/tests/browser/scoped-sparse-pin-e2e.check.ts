import {expect,test} from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";
test("SCOPED-SPARSE-PIN: a coherent published pin with sparse resource hashes cannot grant a writer",async({page})=>{
 await page.goto("/");await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
 expect(await page.evaluate(()=>window.__telegramProjectHarness.publishFixture("a","pin-project","pin-r1"))).toEqual({kind:"durable"});
 expect(await page.evaluate(()=>window.__telegramProjectHarness.access("a","pin-project"))).toEqual({kind:"writable",fencingToken:1});
 const healthy=await page.evaluate(()=>window.__telegramProjectHarness.load("a","pin-project"));expect(healthy.kind).toBe("durable");
 const fault=await page.evaluate(()=>window.__telegramProjectHarness.sparsePublishedPin("a","a","pin-project","pin-r1"));expect(fault.nativeLength).toBe(1);expect(fault.nativeOwnKeys).toEqual([]);
 const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
 const access=await page.evaluate(()=>window.__telegramProjectHarness.access("a","pin-project"));
 expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
 expect(await page.evaluate(()=>window.__telegramProjectHarness.load("a","pin-project"))).toEqual(healthy);
 expect(await page.evaluate(()=>window.__telegramProjectHarness.readRecoverySource("a","pin-project","pin-r1"))).toEqual({kind:"unverified-source",projectId:"pin-project",revisionId:"pin-r1",serializedProject:fault.originalSource});
 expect(access).toEqual({kind:"not-ready"});
});
