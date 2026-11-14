// Focused mutation evidence for assigning every derived successor face to the
// exact polygonal predecessor after a post-closure Wall addition.
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
		fileName:
			"reports/mutation/post-diagonal-room-reconciliation-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:3221-3227",
		"src/domain/general-wall-project.ts:3237-3254",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
