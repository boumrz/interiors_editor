# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scoped-sparse-pin-e2e.check.ts >> SCOPED-SPARSE-PIN: a coherent published pin with sparse resource hashes cannot grant a writer
- Location: tests/browser/scoped-sparse-pin-e2e.check.ts:3:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 2

  Object {
-   "kind": "not-ready",
+   "fencingToken": 1,
+   "kind": "writable",
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
  3  | test("SCOPED-SPARSE-PIN: a coherent published pin with sparse resource hashes cannot grant a writer",async({page})=>{
  4  |  await page.goto("/");await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
  5  |  expect(await page.evaluate(()=>window.__telegramProjectHarness.publishFixture("a","pin-project","pin-r1"))).toEqual({kind:"durable"});
  6  |  expect(await page.evaluate(()=>window.__telegramProjectHarness.access("a","pin-project"))).toEqual({kind:"writable",fencingToken:1});
  7  |  const healthy=await page.evaluate(()=>window.__telegramProjectHarness.load("a","pin-project"));expect(healthy.kind).toBe("durable");
  8  |  const fault=await page.evaluate(()=>window.__telegramProjectHarness.sparsePublishedPin("a","a","pin-project","pin-r1"));expect(fault.nativeLength).toBe(1);expect(fault.nativeOwnKeys).toEqual([]);
  9  |  const before=await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"));
  10 |  const access=await page.evaluate(()=>window.__telegramProjectHarness.access("a","pin-project"));
  11 |  expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
  12 |  expect(await page.evaluate(()=>window.__telegramProjectHarness.load("a","pin-project"))).toEqual(healthy);
  13 |  expect(await page.evaluate(()=>window.__telegramProjectHarness.readRecoverySource("a","pin-project","pin-r1"))).toEqual({kind:"unverified-source",projectId:"pin-project",revisionId:"pin-r1",serializedProject:fault.originalSource});
> 14 |  expect(access).toEqual({kind:"not-ready"});
     |                 ^ Error: expect(received).toEqual(expected) // deep equality
  15 | });
  16 | 
```