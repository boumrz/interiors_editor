# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 00-scoped-resource-cas-e2e.check.ts >> SCOPED-CAS-write-pinned-version: exact stored metadata must still match after actual Blob verification
- Location: tests/browser/00-scoped-resource-cas-e2e.check.ts:5:2

# Error details

```
Error: [SCOPED_SUBJECT_ACTIVATION_INVALID] {"id":null,"testId":"6626134c82f33a301189-3fc0111f600ec994c5a1","file":"/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-common-expanded-corps-1ypq1ym4/apps/web/tests/browser/00-scoped-resource-cas-e2e.check.ts","title":"SCOPED-CAS-write-pinned-version: exact stored metadata must still match after actual Blob verification","expectedSources":{"scoped-project-repository.ts":"0000000000000000000000000000000000000000000000000000000000000000","telegram-project-repository.ts":"749f479318f3c9fa3349b72ba01a5427edd5245b959c8a80cf1a964b946c81ab","scoped-writer-lease.ts":"f20e962b07efb8f895a5fdfa7b284b3e4ca9d43e8cbb058cf32d31792009398f","telegram-writer-lease.ts":"b1dba3e457eab84afc5258b5f86589b07393d1e59c7e3406a597447449ccf8ad","telegram-scope-store.ts":"a635b0d21bdaf33f94dc6a35f7cb2bf3874e1ce09f4f8a0dc72b5ac903888700","browser-registered-project-repository.ts":"c81c665f692d57498d76b01fb3898f2c39ff52ac6615a4d6e19ed0238f8264d0","browser-registered-writer-lease.ts":"ab676701c7671c0a94527ece3b909cc03be953917cff62f0df7dfe68c2dd395f","browser-registered-scope-store.ts":"e05d11eb3537a7a1fe7a156f23db391e6a9b3da5146de450c88ffdac4e69cc2e"},"selected":[],"actual":{"html":null,"modules":{"telegram-scope-store.ts":{"sha":"a635b0d21bdaf33f94dc6a35f7cb2bf3874e1ce09f4f8a0dc72b5ac903888700","instrumented":false,"active":null},"scoped-project-repository.ts":{"sha":"0d61a438e8325d9753bd77ef70d86316b73c89a7c4c27f179d5b5bcf76faab6b","instrumented":false,"active":null},"scoped-writer-lease.ts":{"sha":"f20e962b07efb8f895a5fdfa7b284b3e4ca9d43e8cbb058cf32d31792009398f","instrumented":false,"active":null},"telegram-writer-lease.ts":{"sha":"b1dba3e457eab84afc5258b5f86589b07393d1e59c7e3406a597447449ccf8ad","instrumented":false,"active":null},"telegram-project-repository.ts":{"sha":"749f479318f3c9fa3349b72ba01a5427edd5245b959c8a80cf1a964b946c81ab","instrumented":false,"active":null},"browser-registered-writer-lease.ts":{"sha":"ab676701c7671c0a94527ece3b909cc03be953917cff62f0df7dfe68c2dd395f","instrumented":false,"active":null},"browser-registered-project-repository.ts":{"sha":"c81c665f692d57498d76b01fb3898f2c39ff52ac6615a4d6e19ed0238f8264d0","instrumented":false,"active":null},"browser-registered-scope-store.ts":{"sha":"e05d11eb3537a7a1fe7a156f23db391e6a9b3da5146de450c88ffdac4e69cc2e","instrumented":false,"active":null}}},"valid":false}
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```

# Test source

```ts
  1   | import {
  2   | 	test as base,
  3   | 	expect,
  4   | 	type Page,
  5   | 	type TestInfo,
  6   | } from "@playwright/test";
  7   | export { expect };
  8   | export type { Page };
  9   | async function appendRecord(info: TestInfo, record: Record<string, unknown>) {
  10  | 	const fsModule = "node:fs/promises";
  11  | 	const files: { appendFile(path: string, data: string): Promise<void> } =
  12  | 		await import(fsModule);
  13  | 	try {
  14  | 		await files.appendFile(
  15  | 			info.project.metadata.activationLedger,
  16  | 			`${JSON.stringify(record)}\n`,
  17  | 		);
  18  | 	} catch (error) {
  19  | 		throw new Error(`[SCOPED_PROOF_LEDGER_IO_INVALID] ${String(error)}`, {
  20  | 			cause: error,
  21  | 		});
  22  | 	}
  23  | }
  24  | async function navigationFailure(
  25  | 	info: TestInfo,
  26  | 	error: unknown,
  27  | ): Promise<never> {
  28  | 	let recordingFailure = "";
  29  | 	try {
  30  | 		await appendRecord(info, {
  31  | 			id: info.project.metadata.activeMutant ?? null,
  32  | 			testId: info.testId,
  33  | 			file: info.file,
  34  | 			title: info.title,
  35  | 			expectedSources: info.project.metadata.subjectSources,
  36  | 			selected: info.project.metadata.subjectSelected,
  37  | 			valid: false,
  38  | 			navigationFailure: String(error),
  39  | 		});
  40  | 	} catch (failure) {
  41  | 		recordingFailure = `; recording: ${String(failure)}`;
  42  | 	}
  43  | 	throw new Error(
  44  | 		`[SCOPED_SUBJECT_NAVIGATION_INVALID] ${String(error)}${recordingFailure}`,
  45  | 		{ cause: error },
  46  | 	);
  47  | }
  48  | async function assertSubjects(page: Page, info: TestInfo) {
  49  | 	const expectedId = info.project.metadata.activeMutant ?? null;
  50  | 	const expectedSources: Record<string, string> =
  51  | 		info.project.metadata.subjectSources;
  52  | 	const selected: string[] = info.project.metadata.subjectSelected;
  53  | 	const actual = await page.evaluate(() => {
  54  | 		const records = Reflect.get(globalThis, "__interiorsScopedSubjects") ?? {};
  55  | 		return {
  56  | 			html: Reflect.get(globalThis, "__stryker__")?.activeMutant ?? null,
  57  | 			modules: Object.fromEntries(
  58  | 				Object.entries(records).map(([key, value]) => {
  59  | 					const record = value as {
  60  | 						sha: string;
  61  | 						instrumented: boolean;
  62  | 						readActive: () => string | null;
  63  | 					};
  64  | 					return [
  65  | 						key,
  66  | 						{
  67  | 							sha: record.sha,
  68  | 							instrumented: record.instrumented,
  69  | 							active: record.readActive(),
  70  | 						},
  71  | 					];
  72  | 				}),
  73  | 			),
  74  | 		};
  75  | 	});
  76  | 	const invalid =
  77  | 		actual.html !== expectedId ||
  78  | 		Object.entries(expectedSources).some(([key, sha]) => {
  79  | 			const module = actual.modules[key];
  80  | 			return (
  81  | 				!module ||
  82  | 				module.sha !== sha ||
  83  | 				(selected.includes(key) &&
  84  | 					(module.active !== expectedId ||
  85  | 						(expectedId !== null && !module.instrumented)))
  86  | 			);
  87  | 		});
  88  | 	const record = {
  89  | 		id: expectedId,
  90  | 		testId: info.testId,
  91  | 		file: info.file,
  92  | 		title: info.title,
  93  | 		expectedSources,
  94  | 		selected,
  95  | 		actual,
  96  | 		valid: !invalid,
  97  | 	};
  98  | 	await appendRecord(info, record);
  99  | 	if (invalid)
> 100 | 		throw new Error(
      |         ^ Error: [SCOPED_SUBJECT_ACTIVATION_INVALID] {"id":null,"testId":"6626134c82f33a301189-3fc0111f600ec994c5a1","file":"/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-common-expanded-corps-1ypq1ym4/apps/web/tests/browser/00-scoped-resource-cas-e2e.check.ts","title":"SCOPED-CAS-write-pinned-version: exact stored metadata must still match after actual Blob verification","expectedSources":{"scoped-project-repository.ts":"0000000000000000000000000000000000000000000000000000000000000000","telegram-project-repository.ts":"749f479318f3c9fa3349b72ba01a5427edd5245b959c8a80cf1a964b946c81ab","scoped-writer-lease.ts":"f20e962b07efb8f895a5fdfa7b284b3e4ca9d43e8cbb058cf32d31792009398f","telegram-writer-lease.ts":"b1dba3e457eab84afc5258b5f86589b07393d1e59c7e3406a597447449ccf8ad","telegram-scope-store.ts":"a635b0d21bdaf33f94dc6a35f7cb2bf3874e1ce09f4f8a0dc72b5ac903888700","browser-registered-project-repository.ts":"c81c665f692d57498d76b01fb3898f2c39ff52ac6615a4d6e19ed0238f8264d0","browser-registered-writer-lease.ts":"ab676701c7671c0a94527ece3b909cc03be953917cff62f0df7dfe68c2dd395f","browser-registered-scope-store.ts":"e05d11eb3537a7a1fe7a156f23db391e6a9b3da5146de450c88ffdac4e69cc2e"},"selected":[],"actual":{"html":null,"modules":{"telegram-scope-store.ts":{"sha":"a635b0d21bdaf33f94dc6a35f7cb2bf3874e1ce09f4f8a0dc72b5ac903888700","instrumented":false,"active":null},"scoped-project-repository.ts":{"sha":"0d61a438e8325d9753bd77ef70d86316b73c89a7c4c27f179d5b5bcf76faab6b","instrumented":false,"active":null},"scoped-writer-lease.ts":{"sha":"f20e962b07efb8f895a5fdfa7b284b3e4ca9d43e8cbb058cf32d31792009398f","instrumented":false,"active":null},"telegram-writer-lease.ts":{"sha":"b1dba3e457eab84afc5258b5f86589b07393d1e59c7e3406a597447449ccf8ad","instrumented":false,"active":null},"telegram-project-repository.ts":{"sha":"749f479318f3c9fa3349b72ba01a5427edd5245b959c8a80cf1a964b946c81ab","instrumented":false,"active":null},"browser-registered-writer-lease.ts":{"sha":"ab676701c7671c0a94527ece3b909cc03be953917cff62f0df7dfe68c2dd395f","instrumented":false,"active":null},"browser-registered-project-repository.ts":{"sha":"c81c665f692d57498d76b01fb3898f2c39ff52ac6615a4d6e19ed0238f8264d0","instrumented":false,"active":null},"browser-registered-scope-store.ts":{"sha":"e05d11eb3537a7a1fe7a156f23db391e6a9b3da5146de450c88ffdac4e69cc2e","instrumented":false,"active":null}}},"valid":false}
  101 | 			`[SCOPED_SUBJECT_ACTIVATION_INVALID] ${JSON.stringify(record)}`,
  102 | 		);
  103 | }
  104 | export const test = base.extend({
  105 | 	context: async ({ context }, use, info) => {
  106 | 		const originals = new Map<Page, () => void>();
  107 | 		const install = (page: Page) => {
  108 | 			if (originals.has(page)) return;
  109 | 			const goto = page.goto.bind(page),
  110 | 				reload = page.reload.bind(page);
  111 | 			page.goto = async (...arguments_) => {
  112 | 				const response = await goto(...arguments_).catch((error) =>
  113 | 					navigationFailure(info, error),
  114 | 				);
  115 | 				await assertSubjects(page, info);
  116 | 				return response;
  117 | 			};
  118 | 			page.reload = async (...arguments_) => {
  119 | 				const response = await reload(...arguments_).catch((error) =>
  120 | 					navigationFailure(info, error),
  121 | 				);
  122 | 				await assertSubjects(page, info);
  123 | 				return response;
  124 | 			};
  125 | 			originals.set(page, () => {
  126 | 				page.goto = goto;
  127 | 				page.reload = reload;
  128 | 			});
  129 | 		};
  130 | 		context.pages().forEach(install);
  131 | 		context.on("page", install);
  132 | 		try {
  133 | 			await use(context);
  134 | 		} finally {
  135 | 			context.off("page", install);
  136 | 			originals.forEach((restore) => {
  137 | 				restore();
  138 | 			});
  139 | 		}
  140 | 	},
  141 | });
  142 | 
```