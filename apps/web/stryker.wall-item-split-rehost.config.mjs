// Focused mutation evidence for deterministic wall-item lineage during a
// single-wall split. It runs in place; do not edit the selected modules while
// this command is running.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/general-wall-project.test.ts src/domain/parametric-wall-item.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/wall-item-split-rehost-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:681-690",
		"src/domain/general-wall-project.ts:741-751",
		"src/domain/general-wall-project.ts:1360-1382",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 80,
		low: 70,
	},
};
