import {expect,test} from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";
const fields=["scope","asset-hash","asset-id","asset-width","asset-size","asset-format","removed","extra"]as const;
test("SCOPED-LIBRARY-MATRIX: unknown ownership or malformed asset metadata cannot be listed, removed, or adopted",async({page})=>{
 await page.goto("/");await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
 await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","library","library-project","library-r1",[71,72,73]));await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","library"));expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","library"))).toEqual({kind:"durable"});
 expect((await page.evaluate(()=>window.__telegramProjectHarness.registerPreparedLibrary("a","library"))).kind).toBe("registered");expect((await page.evaluate(()=>window.__telegramProjectHarness.library("a"))).map(x=>x.assetDefinitionId)).toEqual(["custom"]);
 for(const field of fields)await test.step(field,async()=>{
  const original=await page.evaluate(field=>window.__telegramProjectHarness.libraryFault("a",field),field);const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
  const queries=await page.evaluate(async()=>{const outcomes=[];for(const action of[()=>window.__telegramProjectHarness.library("a"),()=>window.__telegramProjectHarness.removeLibrary("a","custom")])try{await action();outcomes.push("resolved");}catch{outcomes.push("rejected");}return outcomes;});expect(queries).toEqual(["rejected","rejected"]);expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
  const registration=await page.evaluate(async()=>{try{await window.__telegramProjectHarness.registerPreparedLibrary("a","library");return"resolved";}catch{return"rejected";}});expect(registration).toBe("rejected");const after=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));expect(after.filter(x=>x.name!=="scope-metadata")).toEqual(before.filter(x=>x.name!=="scope-metadata"));
  const previous=before.find(x=>x.name==="scope-metadata"),next=after.find(x=>x.name==="scope-metadata");if(!previous||!next)throw new Error("Missing actual metadata rows");expect(next.rows.filter(x=>typeof x==="object"&&x!==null&&Reflect.get(x,"key")!=="counter")).toEqual(previous.rows.filter(x=>typeof x==="object"&&x!==null&&Reflect.get(x,"key")!=="counter"));
  const priorCounter=previous.rows.find(x=>typeof x==="object"&&x!==null&&Reflect.get(x,"key")==="counter"),nextCounter=next.rows.find(x=>typeof x==="object"&&x!==null&&Reflect.get(x,"key")==="counter");if(!priorCounter||!nextCounter)throw new Error("Missing native counters");const priorText=Reflect.get(priorCounter,"lastReserved"),nextText=Reflect.get(nextCounter,"lastReserved");if(typeof priorText!=="string"||typeof nextText!=="string")throw new Error("Invalid counter fixture");expect(BigInt(nextText)).toBeGreaterThanOrEqual(BigInt(priorText));

  await page.evaluate(original=>window.__telegramProjectHarness.restoreLibraryRow("a",original),original);expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","library"))).toEqual([71,72,73]);
 });
});
