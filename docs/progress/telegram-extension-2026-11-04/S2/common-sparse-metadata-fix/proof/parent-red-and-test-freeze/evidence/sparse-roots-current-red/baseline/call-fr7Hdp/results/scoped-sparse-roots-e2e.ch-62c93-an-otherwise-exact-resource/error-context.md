# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scoped-sparse-roots-e2e.check.ts >> SCOPED-SPARSE-ROOTS: a native sparse root array cannot authorize reading an otherwise exact resource
- Location: tests/browser/scoped-sparse-roots-e2e.check.ts:4:1

# Error details

```
Error: expect(received).toBeUndefined()

Received: [31, 32, 33]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1  | import {expect,test} from "../verification/scoped-protocol-native-test";
  2  | import type {} from "./telegram-storage-harness";
  3  | // Opaque fixture bytes prove metadata admission only; this is not GLB/render validation.
  4  | test("SCOPED-SPARSE-ROOTS: a native sparse root array cannot authorize reading an otherwise exact resource",async({page})=>{
  5  |  await page.goto("/");
  6  |  await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
  7  |  await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","roots","roots-project","roots-r1",[31,32,33]));
  8  |  await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","roots"));
  9  |  expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","roots"))).toEqual({kind:"durable"});
  10 |  await page.evaluate(()=>window.__telegramProjectHarness.completePrepared("a","roots"));
  11 |  expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","roots"))).toEqual([31,32,33]);
  12 |  const fault=await page.evaluate(()=>window.__telegramProjectHarness.sparseResourceRoots("a","roots"));
  13 |  expect(fault).toEqual({nativeLength:1,nativeOwnKeys:[],durableBefore:true,durableAfter:true});
  14 |  const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
  15 |  const bytes=await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","roots"));
  16 |  expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
> 17 |  expect(bytes).toBeUndefined();
     |                ^ Error: expect(received).toBeUndefined()
  18 | });
  19 | 
```