import { devices } from "@playwright/test";
import { resolve } from "node:path";
import { groupPlan } from "./additive-public-contract.mjs";
export function makePublicConfig(group, env = process.env) {
	const definition = groupPlan(group),
		baseURL = env.PLAYWRIGHT_TMA_STORAGE_BASE_URL,
		output = env.ADDITIVE_PUBLIC_OUTPUT;
	let sources;
	try {
		sources = JSON.parse(env.ADDITIVE_PUBLIC_SOURCES ?? "null");
	} catch {
		throw Error("ADDITIVE_PUBLIC_PROOF_INVALID: source JSON");
	}
	if (
		!baseURL ||
		new URL(baseURL).hostname !== "127.0.0.1" ||
		!output ||
		!sources ||
		!Object.keys(sources).length ||
		Object.values(sources).some(
			(h) => typeof h !== "string" || !/^[a-f0-9]{64}$/.test(h),
		)
	)
		throw Error(
			"ADDITIVE_PUBLIC_PROOF_INVALID: explicit owned loopback/output/source metadata",
		);
	return {
		testDir: "./tests/browser",
		testMatch: [definition.testMatch],
		outputDir: resolve(output, "results"),
		workers: 1,
		retries: 0,
		maxFailures: 1,
		fullyParallel: false,
		timeout: 10000,
		metadata: {
			activeMutant: null,
			subjectSources: sources,
			subjectSelected: [],
			activationLedger: resolve(output, "activation.jsonl"),
			activeOwner: null,
			expectedLocalCounts: Object.fromEntries(
				Object.keys(sources).map((k) => [k, 0]),
			),
			missingSelector: false,
			controlledCleanupInvalid: false,
		},
		reporter: [
			["list"],
			["json", { outputFile: resolve(output, "report.json") }],
			[
				new URL("./factory-native-raw-errors-reporter.mjs", import.meta.url)
					.pathname,
			],
		],
		use: {
			...devices["iPhone 13"],
			browserName: "chromium",
			channel: "chrome",
			baseURL,
			trace: "retain-on-failure",
			screenshot: "only-on-failure",
		},
	};
}
