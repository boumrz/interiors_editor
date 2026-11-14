import {expect,test} from "../verification/scoped-protocol-native-test";
import type {} from "./telegram-storage-harness";
test("SCOPED-LIBRARY-INPUT: invalid incoming metadata or inexact bytes cannot create a local card or mutate a published resource",async({page})=>{
 await page.goto("/");await page.evaluate(async()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);await window.__telegramProjectHarness.prepareResource("a","A","library-input","library-input-r1",[81,82,83]);await window.__telegramProjectHarness.writePrepared("a","A");});
 expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","A"))).toEqual({kind:"durable"});
 expect(await page.evaluate(()=>window.__telegramProjectHarness.library("a"))).toEqual([]);
 for(const mode of["asset-id","asset-name","asset-width","asset-format","asset-hash","declared-size","wrong-exact-bytes"]as const){
  const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
  const outcome=await page.evaluate(async mode=>{try{await window.__telegramProjectHarness.registerInvalidPreparedLibrary("a","A",mode);return{kind:"resolved"};}catch{return{kind:"rejected"};}},mode);
  expect(outcome,mode).toEqual({kind:"rejected"});
  expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a")),mode).toEqual(before);
  expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","A")),mode).toEqual([81,82,83]);
  expect(await page.evaluate(()=>window.__telegramProjectHarness.library("a")),mode).toEqual([]);
 }
});
