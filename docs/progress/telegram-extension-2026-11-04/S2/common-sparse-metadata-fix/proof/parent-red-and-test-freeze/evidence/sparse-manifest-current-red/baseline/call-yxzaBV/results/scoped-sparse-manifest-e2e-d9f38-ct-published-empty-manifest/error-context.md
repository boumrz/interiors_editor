# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scoped-sparse-manifest-e2e.check.ts >> SCOPED-SPARSE-MANIFEST: a native sparse metadata array cannot become the exact published empty manifest
- Location: tests/browser/scoped-sparse-manifest-e2e.check.ts:4:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  2
+ Received  + 28

  Object {
-   "kind": "recovery-needed",
-   "reasonCode": "PERSISTENCE_CORRUPT",
+   "candidate": Object {
+     "project": Object {
+       "assetDefinitionRefs": Array [],
+       "assetInstances": Array [],
+       "createdAt": "2026-11-04T12:00:00.000Z",
+       "level": Object {
+         "levelId": "sparse-project-level",
+         "openings": Array [],
+         "rooms": Array [],
+         "vertices": Array [],
+         "wallSegments": Array [],
+       },
+       "lifecycle": "active",
+       "name": "sparse-project:sparse-r1",
+       "projectId": "sparse-project",
+       "schemaVersion": 1,
+       "updatedAt": "2026-11-04T12:00:00.000Z",
+     },
+     "revision": Object {
+       "checksum": "e53da016462002b60c76f057a5a125d19690f663bc03a659d52c837cbfae3ffb",
+       "createdAt": "2026-11-04T12:00:00.000Z",
+       "projectId": "sparse-project",
+       "revisionId": "sparse-r1",
+       "schemaVersion": 1,
+       "serializedProject": "{\"schemaVersion\":1,\"projectId\":\"sparse-project\",\"name\":\"sparse-project:sparse-r1\",\"createdAt\":\"2026-11-04T12:00:00.000Z\",\"updatedAt\":\"2026-11-04T12:00:00.000Z\",\"lifecycle\":\"active\",\"level\":{\"levelId\":\"sparse-project-level\",\"vertices\":[],\"wallSegments\":[],\"rooms\":[],\"openings\":[]},\"assetInstances\":[],\"assetDefinitionRefs\":[]}",
+     },
+   },
+   "kind": "durable",
  }
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1  | import { expect, test } from "../verification/scoped-protocol-native-test";
  2  | import type {} from "./telegram-storage-harness";
  3  | 
  4  | test("SCOPED-SPARSE-MANIFEST: a native sparse metadata array cannot become the exact published empty manifest", async ({ page }) => {
  5  | 	await page.goto("/");
  6  | 	await page.evaluate(() => window.__telegramProjectHarness.create("a", "a", "owner-a"));
  7  | 	expect(await page.evaluate(() => window.__telegramProjectHarness.publishFixture("a", "sparse-project", "sparse-r1"))).toEqual({ kind: "durable" });
  8  | 	expect((await page.evaluate(() => window.__telegramProjectHarness.load("a", "sparse-project"))).kind).toBe("durable");
  9  | 	const fault = await page.evaluate(() => window.__telegramProjectHarness.sparseCurrentManifest("a", "sparse-r1"));
  10 | 	expect(fault.nativeLength).toBe(1);
  11 | 	expect(fault.nativeOwnKeys).toEqual([]);
  12 | 	const before = await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"));
> 13 | 	expect(await page.evaluate(() => window.__telegramProjectHarness.load("a", "sparse-project"))).toEqual({ kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" });
     |                                                                                                 ^ Error: expect(received).toEqual(expected) // deep equality
  14 | 	expect(await page.evaluate(() => window.__telegramProjectHarness.recover("a"))).toEqual({ kind: "recovered" });
  15 | 	expect(await page.evaluate(() => window.__telegramProjectHarness.readRecoverySource("a", "sparse-project", "sparse-r1"))).toEqual({ kind: "unverified-source", projectId: "sparse-project", revisionId: "sparse-r1", serializedProject: fault.originalSource });
  16 | 	expect(await page.evaluate(() => window.__telegramProjectHarness.protocolSnapshot("a"))).toEqual(before);
  17 | });
  18 | 
```