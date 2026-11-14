// Focused mutation evidence for wall-host deletion consequences. It runs in
// place; do not edit the selected module while this command is running.
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
		fileName: "reports/mutation/wall-item-delete-conflict-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:399-400",
		"src/domain/general-wall-project.ts:1916-1933",
		"src/domain/general-wall-project.ts:2383-2399",
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
