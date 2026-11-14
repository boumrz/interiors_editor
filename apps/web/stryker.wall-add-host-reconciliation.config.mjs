// Focused mutation evidence for exact wall-local lineage when AddWallSegment
// normalizes one or more T/X contacts through an existing hosted Wall.
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
			"reports/mutation/wall-add-host-reconciliation-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:359-366",
		"src/domain/general-wall-project.ts:423-424",
		"src/domain/general-wall-project.ts:430-439",
		"src/domain/general-wall-project.ts:1646-1714",
		"src/domain/general-wall-project.ts:1722-1724",
		"src/domain/general-wall-project.ts:1741-1789",
		"src/domain/general-wall-project.ts:2947-2950",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
