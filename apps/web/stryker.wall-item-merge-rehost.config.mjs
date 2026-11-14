// Focused mutation evidence for rehosting a wall-local item when a redundant
// inline Vertex is removed. Runs in place; do not edit selected code while on.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/general-wall-project.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/wall-item-merge-rehost-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:1260-1271",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
