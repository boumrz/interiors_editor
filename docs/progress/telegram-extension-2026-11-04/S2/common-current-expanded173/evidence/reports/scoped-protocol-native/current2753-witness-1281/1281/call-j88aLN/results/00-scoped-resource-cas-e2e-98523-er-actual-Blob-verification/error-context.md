# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 00-scoped-resource-cas-e2e.check.ts >> SCOPED-CAS-write-pinned-version: exact stored metadata must still match after actual Blob verification
- Location: tests/browser/00-scoped-resource-cas-e2e.check.ts:5:2

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

  Object {
-   "kind": "rejected",
+   "kind": "resolved",
+   "value": Object {
+     "kind": "already-present",
+   },
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
  3  | // Actual native ownership/CAS proof with opaque bytes; no GLB validation or signed identity claim.
  4  | for(const operation of ["write-pinned","register-library"]as const)for(const field of["version","creationLeaseId","roots","durable"]as const){
  5  |  test(`SCOPED-CAS-${operation}-${field}: exact stored metadata must still match after actual Blob verification`,async({page})=>{
  6  |   await page.goto("/");await page.evaluate(()=>{window.__telegramProjectHarness.create("a","a","owner-a");window.__telegramProjectHarness.setNow("a",1000);});
  7  |   await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","base","cas-base","base-r1",[41,42,43]));
  8  |   expect(await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","base"))).toEqual({kind:"stored"});
  9  |   expect(await page.evaluate(()=>window.__telegramProjectHarness.publishPrepared("a","base"))).toEqual({kind:"durable"});
  10 |   await page.evaluate(()=>window.__telegramProjectHarness.prepareResource("a","incoming","cas-incoming","incoming-r1",[41,42,43]));
  11 |   if(operation==="write-pinned")expect(await page.evaluate(()=>window.__telegramProjectHarness.writePrepared("a","incoming"))).toEqual({kind:"already-present"});
  12 |   else expect((await page.evaluate(()=>window.__telegramProjectHarness.registerPreparedLibrary("a","incoming"))).kind).toBe("registered");
  13 |   await page.evaluate(field=>window.__telegramProjectHarness.armResourceCAS("a","a","incoming",field),field);
  14 |   const result=await page.evaluate(async operation=>{try{const value=operation==="write-pinned"?await window.__telegramProjectHarness.writePrepared("a","incoming"):await window.__telegramProjectHarness.registerPreparedLibrary("a","incoming");return{kind:"resolved",value};}catch{return{kind:"rejected"};}},operation);
  15 |   const proof=await page.evaluate(()=>window.__telegramProjectHarness.resourceCASProof("incoming"));
  16 |   expect(proof).toMatchObject({field,digestCalls:2,digestMatches:true});if(!proof)throw new Error("Missing actual digest boundary proof");expect(proof.after).not.toEqual(proof.before);
  17 |   expect(await page.evaluate(()=>window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(proof.afterFaultSnapshot);
> 18 |   expect(result).toEqual({kind:"rejected"});
     |                  ^ Error: expect(received).toEqual(expected) // deep equality
  19 |   expect(await page.evaluate(()=>window.__telegramProjectHarness.resourceBytes("a","base"))).toEqual([41,42,43]);
  20 |  });
  21 | }
  22 | 
```