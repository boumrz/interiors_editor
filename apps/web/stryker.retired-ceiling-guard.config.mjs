// Proves that retired ceiling-host payloads cannot re-enter through either
// the placement boundary or local-project JSON transfer.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/asset-placement.test.ts src/domain/project-json-transfer.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/retired-ceiling-guard-mutation.json",
	},
	mutate: [
		"src/domain/asset-placement.ts:77-78",
		"src/domain/project-json-transfer.ts:366-366",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
