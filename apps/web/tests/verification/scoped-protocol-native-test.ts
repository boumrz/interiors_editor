import {
	test as base,
	expect,
	type Page,
	type TestInfo,
} from "@playwright/test";
export { expect };
export type { Page };
async function appendRecord(info: TestInfo, record: Record<string, unknown>) {
	const fsModule = "node:fs/promises";
	const files: { appendFile(path: string, data: string): Promise<void> } =
		await import(fsModule);
	try {
		await files.appendFile(
			info.project.metadata.activationLedger,
			`${JSON.stringify(record)}\n`,
		);
	} catch (error) {
		throw new Error(`[SCOPED_PROOF_LEDGER_IO_INVALID] ${String(error)}`, {
			cause: error,
		});
	}
}
async function navigationFailure(
	info: TestInfo,
	error: unknown,
): Promise<never> {
	let recordingFailure = "";
	try {
		await appendRecord(info, {
			id: info.project.metadata.activeMutant ?? null,
			testId: info.testId,
			file: info.file,
			title: info.title,
			expectedSources: info.project.metadata.subjectSources,
			selected: info.project.metadata.subjectSelected,
			valid: false,
			navigationFailure: String(error),
		});
	} catch (failure) {
		recordingFailure = `; recording: ${String(failure)}`;
	}
	throw new Error(
		`[SCOPED_SUBJECT_NAVIGATION_INVALID] ${String(error)}${recordingFailure}`,
		{ cause: error },
	);
}
async function assertSubjects(page: Page, info: TestInfo) {
	const expectedId = info.project.metadata.activeMutant ?? null;
	const expectedSources: Record<string, string> =
		info.project.metadata.subjectSources;
	const selected: string[] = info.project.metadata.subjectSelected;
	const actual = await page.evaluate(() => {
		const records = Reflect.get(globalThis, "__interiorsScopedSubjects") ?? {};
		return {
			html: Reflect.get(globalThis, "__stryker__")?.activeMutant ?? null,
			modules: Object.fromEntries(
				Object.entries(records).map(([key, value]) => {
					const record = value as {
						sha: string;
						instrumented: boolean;
						readActive: () => string | null;
					};
					return [
						key,
						{
							sha: record.sha,
							instrumented: record.instrumented,
							active: record.readActive(),
						},
					];
				}),
			),
		};
	});
	const invalid =
		actual.html !== expectedId ||
		Object.entries(expectedSources).some(([key, sha]) => {
			const module = actual.modules[key];
			return (
				!module ||
				module.sha !== sha ||
				(selected.includes(key) &&
					(module.active !== expectedId ||
						(expectedId !== null && !module.instrumented)))
			);
		});
	const record = {
		id: expectedId,
		testId: info.testId,
		file: info.file,
		title: info.title,
		expectedSources,
		selected,
		actual,
		valid: !invalid,
	};
	await appendRecord(info, record);
	if (invalid)
		throw new Error(
			`[SCOPED_SUBJECT_ACTIVATION_INVALID] ${JSON.stringify(record)}`,
		);
}
export const test = base.extend({
	context: async ({ context }, use, info) => {
		const originals = new Map<Page, () => void>();
		const install = (page: Page) => {
			if (originals.has(page)) return;
			const goto = page.goto.bind(page),
				reload = page.reload.bind(page);
			page.goto = async (...arguments_) => {
				const response = await goto(...arguments_).catch((error) =>
					navigationFailure(info, error),
				);
				await assertSubjects(page, info);
				return response;
			};
			page.reload = async (...arguments_) => {
				const response = await reload(...arguments_).catch((error) =>
					navigationFailure(info, error),
				);
				await assertSubjects(page, info);
				return response;
			};
			originals.set(page, () => {
				page.goto = goto;
				page.reload = reload;
			});
		};
		context.pages().forEach(install);
		context.on("page", install);
		try {
			await use(context);
		} finally {
			context.off("page", install);
			originals.forEach((restore) => {
				restore();
			});
		}
	},
});
