# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-scoped-library-input-e2e.check.ts >> SCOPED-LIBRARY-INPUT: invalid incoming metadata or inexact bytes cannot create a local card or mutate a published resource
- Location: tests/browser/03-scoped-library-input-e2e.check.ts:3:1

# Error details

```
Error: declared-size

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
-   "kind": "rejected",
+   "kind": "resolved",
  }
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1  | import {expect,test} from "../verification/scoped-protocol-native-test";
  2  | import type {} from "./telegram-storage-harness";
  3  | test("SCOPED-LIBRARY-INPUT: invalid incoming metadata or inexact bytes cannot create a local card or mutate a published resource",async({page})=>{
  4  |  await page.goto("/");await page.evaluate(async()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);await window.__telegramProjectHarness.prepareResource("a","A","library-input","library-input-r1",[81,82,83]);await window.__telegramProjectHarness.writePrepared("a","A");});
  5  |  expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","A"))).toEqual({kind:"durable"});
  6  |  expect(await page.evaluate(()=>window.__telegramProjectHarness.library("a"))).toEqual([]);
  7  |  for(const mode of["asset-id","asset-name","asset-width","asset-format","asset-hash","declared-size","wrong-exact-bytes"]as const){
  8  |   const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
  9  |   const outcome=await page.evaluate(async mode=>{try{await window.__telegramProjectHarness.registerInvalidPreparedLibrary("a","A",mode);return{kind:"resolved"};}catch{return{kind:"rejected"};}},mode);
> 10 |   expect(outcome,mode).toEqual({kind:"rejected"});
     |                        ^ Error: declared-size
  11 |   expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a")),mode).toEqual(before);
  12 |   expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","A")),mode).toEqual([81,82,83]);
  13 |   expect(await page.evaluate(()=>window.__telegramProjectHarness.library("a")),mode).toEqual([]);
  14 |  }
  15 | });
  16 | 
```