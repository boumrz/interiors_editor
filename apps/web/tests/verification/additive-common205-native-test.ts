// @ts-nocheck
import {
	test as base,
	expect,
	type Page,
	type TestInfo,
} from "@playwright/test";

export type { Page };
export { expect };

async function appendRecord(info: TestInfo, record: Record<string, unknown>) {
	const fsModule = "node:fs/promises";
	try {
		const files: { appendFile(path: string, data: string): Promise<void> } =
			await import(fsModule);
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
 const expectedLocalCounts:Record<string,number>=info.project.metadata.expectedLocalCounts;
 const activeOwner:string|null=info.project.metadata.activeOwner;
	const actual = await page.evaluate((selector:string|null) => {
		const records = Reflect.get(globalThis, "__interiorsScopedSubjects") ?? {};
		return {
			html: Reflect.get(globalThis, "__stryker__")?.activeMutant ?? null,
			modules: Object.fromEntries(
				Object.entries(records).map(([key, value]) => {
					const record = value as {
						sha: string;
						instrumented: boolean;
						readActive: () => string | null;
 localIDs:string[];
					};
					return [
						key,
						{
							sha: record.sha,
							instrumented: record.instrumented,
							active: record.readActive(),
 hasActive:selector!==null&&record.localIDs.includes(selector),
 localIdCount:record.localIDs.length,
						},
					];
				}),
			),
		};
	},expectedId);
	const invalid =
		actual.html !== expectedId ||
		Object.entries(expectedSources).some(([key, sha]) => {
			const module = actual.modules[key];
			return (
				!module ||
				module.sha !== sha ||
 module.localIdCount!==expectedLocalCounts[key]||
 module.hasActive!==(expectedId!==null&&key===activeOwner)||
				(selected.includes(key) &&
					(module.active !== expectedId ||
						(expectedId !== null && !module.instrumented)))
			);
		});
	const record = {
		pid: Reflect.get(globalThis, 'process').pid,
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
const nativeTimer = globalThis.setTimeout;
const clearNativeTimer = globalThis.clearTimeout;
const transportFailure = (error: unknown) =>
	/Target (?:page,\s*context or browser|page|context|browser) (?:has been )?closed|Execution context was destroyed|Frame (?:was|has been) detached|Browser has been closed|Target closed/i.test(
		String(error),
	);
async function invalidProof(info: TestInfo, reason: string): Promise<never> {
	console.error(`[SCOPED_PROOF_INVALID] ${reason}`);
	try {
		await appendRecord(info, {
			proofInvalid: reason,
			testId: info.testId,
			file: info.file,
			title: info.title,
		});
	} catch (error) {
		throw new Error(
			`[SCOPED_PROOF_INVALID] ${reason}; invalid-sidecar-write-failed`,
			{ cause: error },
		);
	}
	throw new Error(`[SCOPED_PROOF_INVALID] ${reason}`);
}
async function boundedPublicEvaluation<T>(
	operation: Promise<T>,
	info: TestInfo,
): Promise<T> {
	let handle: ReturnType<typeof setTimeout> | undefined;
	const result = await Promise.race([
		operation.then(
			(value) => ({ kind: "fulfilled" as const, value }),
			(reason) => ({ kind: "rejected" as const, reason }),
		),
		new Promise<{ kind: "pending" }>((resolve) => {
			handle = nativeTimer(() => resolve({ kind: "pending" }), 2500);
		}),
	]).finally(() => {
		if (handle !== undefined) clearNativeTimer(handle);
	});
	if (result.kind === "pending") {
		// Record a real named failure before throwing. Old `.rejects` cannot erase it.
		expect
			.soft(
				result.kind,
				"public evaluation must settle within its bounded completion oracle",
			)
			.not.toBe("pending");
		throw new Error("Public evaluation did not settle");
	}
	if (result.kind === "rejected") {
		if (transportFailure(result.reason))
			return invalidProof(info, "public-evaluation-transport");
		throw result.reason;
	}
	return result.value;
}
async function verifySubjects(page: Page, info: TestInfo): Promise<void> {
	let handle: ReturnType<typeof setTimeout> | undefined;
	const result = await Promise.race([
		assertSubjects(page, info).then(
			() => ({ kind: "fulfilled" as const }),
			(reason) => ({ kind: "rejected" as const, reason }),
		),
		new Promise<{ kind: "pending" }>((resolve) => {
			handle = nativeTimer(() => resolve({ kind: "pending" }), 2500);
		}),
	]).finally(() => {
		if (handle !== undefined) clearNativeTimer(handle);
	});
	if (result.kind !== "fulfilled")
		await invalidProof(info, `subject-canary-${result.kind}`);
}
export const test = base.extend({
	context: async ({ context }, use, info) => {
		if (!info.project.metadata.missingSelector)
			await context.addInitScript((activeMutant: string | null) => {
				Reflect.set(globalThis, "__stryker__", { activeMutant });
			}, info.project.metadata.activeMutant ?? null);
		const originals = new Map<Page, () => void>();
		const install = (page: Page) => {
			if (originals.has(page)) return;
			const goto = page.goto.bind(page),
				reload = page.reload.bind(page),
				evaluate = page.evaluate.bind(page);
			let activated = false;
			page.evaluate = (async (...arguments_: Parameters<Page["evaluate"]>) => {
				const operation = evaluate(...arguments_);
				return activated ? boundedPublicEvaluation(operation, info) : operation;
			}) as Page["evaluate"];
			page.goto = async (...arguments_) => {
				activated = false;
				const response = await goto(...arguments_).catch((error) =>
					navigationFailure(info, error),
				);
				await verifySubjects(page, info);
				activated = true;
				return response;
			};
			page.reload = async (...arguments_) => {
				activated = false;
				const response = await reload(...arguments_).catch((error) =>
					navigationFailure(info, error),
				);
				await verifySubjects(page, info);
				activated = true;
				return response;
			};
			originals.set(page, () => {
				page.goto = goto;
				page.reload = reload;
				page.evaluate = evaluate;
			});
		};
		context.pages().forEach(install);
		context.on("page", install);
		try {
			await use(context);
		} finally {
			context.off("page", install);
			// Cleanup failures are infrastructure, even when a body already failed.
			let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
			const closed = await Promise.race([
				Promise.resolve()
					.then(() => context.close())
					.then(
						() => ({ kind: "fulfilled" as const }),
						(reason) => ({ kind: "rejected" as const, reason }),
					),
				new Promise<{ kind: "pending" }>((resolve) => {
					cleanupTimer = nativeTimer(() => resolve({ kind: "pending" }), 2500);
				}),
			]).finally(() => {
				if (cleanupTimer !== undefined) clearNativeTimer(cleanupTimer);
			});
			if (closed.kind !== "fulfilled")
				await invalidProof(info, `context-cleanup-${closed.kind}`);
			if (info.project.metadata.controlledCleanupInvalid === true)
				await invalidProof(info, "controlled-cleanup-negative");
			originals.forEach((restore) => {
				restore();
			});
		}
	},
});
