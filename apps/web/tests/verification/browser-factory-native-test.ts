// @ts-nocheck
// Proof-only callback wrapper; original callbacks and their public fixture values are unchanged.
import { test as subjectTest } from "./additive-common205-native-test";
import type { Page, BrowserContext, TestInfo } from "@playwright/test";
export { expect, type Page } from "./additive-common205-native-test";
export const test: typeof import("@playwright/test").test = subjectTest;
async function mark(info, phase, outcome) {
	const processValue = Reflect.get(globalThis, "process");
	await info.attach("actual-factory-native-body", {
		body: JSON.stringify({
			testId: info.testId,
			file: info.file,
			title: info.title,
			pid: processValue.pid,
			phase,
			...(outcome ? { outcome } : {}),
		}),
		contentType: "application/json",
	});
}
export function withFactoryBodyProof<T>(
	callback: (
		fixtures: { page: Page; context: BrowserContext },
		info: TestInfo,
	) => T | Promise<T>,
) {
	return async ({ page, context }, info) => {
		await mark(info, "entered");
		let outcome = "fulfilled";
		try {
			return await callback({ page, context }, info);
		} catch (error) {
			outcome = "rejected";
			throw error;
		} finally {
			await mark(info, "settled", outcome);
		}
	};
}
