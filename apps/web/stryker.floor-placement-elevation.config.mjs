// Focused mutation evidence for the explicit grounded floor-placement field.
// Stryker mutates sources in place, so do not edit selected modules while it runs.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"sleep 1 && touch src/domain/parametric-item.ts src/domain/parametric-item-v2.ts src/domain/project-json-transfer.ts src/domain/project-v2-codec.ts",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/parametric-item.test.ts src/domain/parametric-item-v2.test.ts src/domain/project-json-transfer.test.ts src/domain/project-v2-codec.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/floor-placement-elevation-mutation.json",
	},
	mutate: [
		"src/domain/parametric-item.ts:263-263",
		"src/domain/parametric-item-v2.ts:47-47",
		"src/domain/project-json-transfer.ts:397-397",
		"src/domain/project-json-transfer.ts:413-413",
		"src/domain/project-v2-codec.ts:264-264",
		"src/domain/project-v2-codec.ts:271-273",
		"src/domain/project-v2-codec.ts:345-350",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
