// Focused mutation evidence for the touch-only 45-degree move and split paths.
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
		fileName: "reports/mutation/diagonal-editing-mutation.json",
	},
	mutate: [
		// The boundary predicates that distinguish a perpendicular translation
		// from sliding along the wall, and an exact diagonal split point from an
		// off-axis candidate. Broader command mutation is tracked separately.
		"src/domain/general-wall-project.ts:802-805",
		"src/domain/general-wall-project.ts:1172-1177",
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
