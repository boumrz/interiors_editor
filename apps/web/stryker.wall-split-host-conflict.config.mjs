// Focused mutation evidence for the complete, stale-safe destructive host
// outcome when a touch Wall split cuts one wall-hosted Item interval.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/wall-split-host-conflict-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:929-967",
		"src/domain/general-wall-project.ts:980-1006",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
