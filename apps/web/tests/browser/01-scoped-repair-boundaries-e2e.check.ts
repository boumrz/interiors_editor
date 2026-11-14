import {expect,test} from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";
for(const mode of["missing-roots","empty-input","foreign-history","duplicate-input","unreferenced-input","wrong-exact-bytes"]as const){
 test(`SCOPED-REPAIR-${mode}: rejected input cannot change any current/history resource or technical row`,async({page})=>{
  await page.goto("/");await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
  for(const[key,projectId,revisionId,bytes]of[["A","repair-A","repair-A-r1",[51,52,53]],["B","repair-B","repair-B-r1",[61,62,63]]]as const){await page.evaluate(async({key,projectId,revisionId,bytes})=>{await window.__telegramProjectHarness.prepareResource("a",key,projectId,revisionId,[...bytes]);await window.__telegramProjectHarness.writePrepared("a",key);}, {key,projectId,revisionId,bytes});expect(await page.evaluate(key=>window.__telegramProjectHarness.publishPrepared("a",key),key)).toEqual({kind:"durable"});}
  if(mode!=="missing-roots")await page.evaluate(mode=>window.__telegramProjectHarness.repairRoots("a","a","repair-A-r1",mode==="foreign-history"?["repair-B-r1"]:[]),mode);
  if(mode==="wrong-exact-bytes")await page.evaluate(()=>window.__telegramProjectHarness.corruptRepairInput("A"));
  const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
  const result=await page.evaluate(async mode=>{const keys=mode==="empty-input"?[]:mode==="duplicate-input"?["A","A"]:mode==="unreferenced-input"?["B"]:["A"];try{await window.__telegramProjectHarness.repairPrepared("a",keys);return{kind:"resolved"};}catch{return{kind:"rejected"};}},mode);
  expect(result).toEqual({kind:"rejected"});expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
  expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","A"))).toEqual([51,52,53]);expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","B"))).toEqual([61,62,63]);
 });
}
