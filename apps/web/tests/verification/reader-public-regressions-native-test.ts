import { expect, type Page, test as base, type TestInfo } from "@playwright/test";

const runtime = Reflect.get(globalThis, "process");
const invocation = runtime.env.READER_PUBLIC_INVOCATION;
if (!invocation) throw new Error("READER_PUBLIC_PROOF_INVALID: missing owned invocation");
const owner = `${runtime.pid}:${runtime.env.TEST_WORKER_INDEX ?? "unknown"}`;
let owns = false;
async function files() {
	const name = "node:fs";
	return import(name);
}
async function observe<T>(operation: Promise<T>, timeoutMs: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation.then(
				(value) => ({ kind: "fulfilled" as const, value }),
				(reason: unknown) => ({ kind: "rejected" as const, reason }),
			),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = setTimeout(() => resolve({ kind: "pending" }), timeoutMs);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
export async function completing<T>(operation: Promise<T>): Promise<T> {
	const result = await observe(operation, 2500);
	if (result.kind === "rejected" && result.reason instanceof Error && /Target page, context or browser has been closed|Target closed|Connection closed/i.test(result.reason.message))
		throw new Error("READER_PUBLIC_PROOF_INVALID: browser transport", { cause: result.reason });
	expect(result.kind).toBe("fulfilled");
	if (result.kind !== "fulfilled") throw new Error("Public operation did not fulfill");
	return result.value;
}
async function technicalCleanup(action: () => unknown | Promise<unknown>) {
	try {
		await action();
	} catch (cause) {
		throw new Error("READER_PUBLIC_PROOF_INVALID: technical cleanup", { cause });
	}
}
const identity = (info: TestInfo) => ({ id: info.testId, file: info.file, title: info.title, pid: runtime.pid, workerIndex: info.workerIndex, parallelIndex: info.parallelIndex });
async function attach(info: TestInfo, name: string, value: unknown) {
	await info.attach(name, { body: JSON.stringify(value), contentType: "application/json" });
}
export const test = base.extend({
	page: async ({ page }, use, info) => {
		const evaluate = page.evaluate;
		const began = performance.now();
		await attach(info, "reader-public-context", { ...identity(info), phase: "opened", atMs: began });
		page.evaluate = new Proxy(evaluate, {
			async apply(target, receiver, args) {
				return completing(Reflect.apply(target, receiver, args));
			},
		});
		try {
			await use(page);
		} finally {
			await technicalCleanup(async () => {
				page.evaluate = evaluate;
				const started = performance.now();
				const closed = await observe(page.context().close(), 13000);
				if (closed.kind !== "fulfilled")
					throw new Error("Context cleanup did not settle", { cause: closed });
				await attach(info, "reader-public-context", { ...identity(info), phase: "closed", atMs: performance.now(), elapsedMs: performance.now() - started, outcome: "fulfilled" });
			});
		}
	},
});
test.beforeAll(async () => {
	try {
		const fs = await files();
		fs.writeFileSync(`${invocation}/worker-owner`, owner, { flag: "wx" });
		owns = true;
		fs.appendFileSync(`${invocation}/workers.jsonl`, `${JSON.stringify({ phase: "start", owner, pid: runtime.pid })}\n`);
	} catch (cause) {
		throw new Error("READER_PUBLIC_PROOF_INVALID: worker ownership", { cause });
	}
});
test.afterAll(async () => {
	await technicalCleanup(async () => {
		if (!owns) return;
		const fs = await files();
		if (fs.readFileSync(`${invocation}/worker-owner`, "utf8") !== owner)
			throw new Error("Foreign worker owner");
		fs.unlinkSync(`${invocation}/worker-owner`);
		fs.appendFileSync(`${invocation}/workers.jsonl`, `${JSON.stringify({ phase: "end", owner, pid: runtime.pid })}\n`);
		owns = false;
	});
});
test.beforeEach(async ({ page }, info) => {
	try {
		await page.goto("/");
		const actualSource = await page.evaluate(({ scope, hashes }) => {
			const global = Reflect.get(globalThis, "__stryker__");
			if (!global || typeof global !== "object" || Reflect.get(global, "activeMutant") !== null)
				throw new Error("Actual global plain selector mismatch");
			const values = Object.entries(hashes as Record<string, string>);
			const table = Reflect.get(globalThis, scope === "browser8" ? "__BROWSER_READONLY_LOADED__" : "__telegramReadonlySubjects");
			if (!table || typeof table !== "object") throw new Error("Missing actual source table");
			const modules = values.map(([path, sha]) => {
				const key = scope === "browser8" ? path : path.split("/").at(-1)?.replace(/\.ts$/, "");
				const marker = key ? Reflect.get(table, key) : undefined;
				if (!marker || marker.sha !== sha || marker.instrumented !== false || typeof marker.readActive !== "function" || marker.readActive() !== null || marker.localIDs?.length)
					throw new Error("Actual plain source mismatch");
				return { path, sha: marker.sha, instrumented: marker.instrumented, actual: marker.readActive() };
			});
			return { globalActive: Reflect.get(global, "activeMutant"), modules };
		}, { scope: info.project.metadata.readerPublicScope, hashes: info.project.metadata.sourceHashes });
		await attach(info, "reader-public-source", { ...identity(info), valid: true, ...actualSource });
	} catch (cause) {
		throw new Error("READER_PUBLIC_PROOF_INVALID: actual source admission", { cause });
	}
});
export function withReaderPublicBody(callback: (args: { page: Page }, info: TestInfo) => Promise<unknown>) {
	return async ({ page }: { page: Page }, info: TestInfo) => {
		await attach(info, "reader-public-body", { ...identity(info), phase: "entered" });
		try {
			await callback({ page }, info);
			await attach(info, "reader-public-body", { ...identity(info), phase: "settled", outcome: "fulfilled" });
		} catch (cause) {
			await attach(info, "reader-public-body", { ...identity(info), phase: "settled", outcome: "rejected" });
			throw cause;
		}
	};
}
export { expect };
