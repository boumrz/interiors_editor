# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scoped-verification-boundary-e2e.check.ts >> SCOPED-VERIFY-resource-version: a verified digest cannot authorize a stale fence or changed resource generation
- Location: tests/browser/scoped-verification-boundary-e2e.check.ts:9:2

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
-   "kind": "persist-failed",
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
  4  | for (const mode of [
  5  | 	"expiry-exact",
  6  | 	"expiry-after",
  7  | 	"resource-version",
  8  | ] as const) {
  9  | 	test(`SCOPED-VERIFY-${mode}: a verified digest cannot authorize a stale fence or changed resource generation`, async ({
  10 | 		page,
  11 | 	}) => {
  12 | 		await page.goto("/");
  13 | 		await page.evaluate(() => {
  14 | 			window.__telegramProjectHarness.create("a", "a", "owner-a");
  15 | 			window.__telegramProjectHarness.setNow("a", 1000);
  16 | 		});
  17 | 		expect(
  18 | 			await page.evaluate(() =>
  19 | 				window.__telegramProjectHarness.publishFixture("a", "kept", "kept-r1"),
  20 | 			),
  21 | 		).toEqual({ kind: "durable" });
  22 | 		const healthy = await page.evaluate(() =>
  23 | 			window.__telegramProjectHarness.load("a", "kept"),
  24 | 		);
  25 | 		await page.evaluate(() =>
  26 | 			window.__telegramProjectHarness.prepareResource(
  27 | 				"a",
  28 | 				"boundary",
  29 | 				"candidate",
  30 | 				"candidate-r1",
  31 | 				[11, 12, 13],
  32 | 			),
  33 | 		);
  34 | 		await page.evaluate(() =>
  35 | 			window.__telegramProjectHarness.writePrepared("a", "boundary"),
  36 | 		);
  37 | 		await page.evaluate(
  38 | 			(mode) =>
  39 | 				window.__telegramProjectHarness.armVerificationBoundary(
  40 | 					"a",
  41 | 					"a",
  42 | 					"boundary",
  43 | 					mode,
  44 | 				),
  45 | 			mode,
  46 | 		);
  47 | 		const outcome = await page.evaluate(() =>
  48 | 			window.__telegramProjectHarness.publishPrepared("a", "boundary"),
  49 | 		);
  50 | 		const proof = await page.evaluate(() =>
  51 | 			window.__telegramProjectHarness.verificationBoundaryProof("boundary"),
  52 | 		);
  53 | 		if (!proof)
  54 | 			throw new Error("Actual resource digest boundary was not reached");
  55 | 		expect(proof.digestMatches).toBe(true);
  56 | 		if (mode === "resource-version") {
  57 | 			expect(proof.afterVersion).not.toBe(proof.beforeVersion);
  58 | 			expect(typeof proof.afterVersion).toBe("string");
  59 | 		} else {
  60 | 			expect(proof.verificationNow).toBe(
  61 | 				proof.writerExpiry + (mode === "expiry-after" ? 1 : 0),
  62 | 			);
  63 | 		}
> 64 | 		expect(outcome).toMatchObject({ kind: "persist-failed" });
     |                   ^ Error: expect(received).toMatchObject(expected)
  65 | 		expect(
  66 | 			await page.evaluate(() =>
  67 | 				window.__telegramProjectHarness.protocolSnapshot("a"),
  68 | 			),
  69 | 		).toEqual(proof.afterFaultSnapshot);
  70 | 		expect(
  71 | 			await page.evaluate(() =>
  72 | 				window.__telegramProjectHarness.load("a", "kept"),
  73 | 			),
  74 | 		).toEqual(healthy);
  75 | 		expect(
  76 | 			await page.evaluate(() =>
  77 | 				window.__telegramProjectHarness.load("a", "candidate"),
  78 | 			),
  79 | 		).toEqual({ kind: "empty" });
  80 | 		const modes = await page.evaluate(
  81 | 			() => window.__telegramScopeHarness.durabilityModes,
  82 | 		);
  83 | 		expect(modes.length).toBeGreaterThan(0);
  84 | 		expect(modes.every((value) => value === "strict")).toBe(true);
  85 | 	});
  86 | }
  87 | 
```