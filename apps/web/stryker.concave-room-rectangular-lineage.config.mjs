// Focused mutation evidence for assigning a rectangular AddWall successor to
// its exact polygonal predecessor instead of borrowing another Room's height.
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
			"reports/mutation/concave-room-rectangular-lineage-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:3221-3224",
		"src/domain/general-wall-project.ts:3234-3244",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
