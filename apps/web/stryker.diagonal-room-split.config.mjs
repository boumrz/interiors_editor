// Focused mutation evidence for a durable diagonal Room split and its exact
// orientation-aware usable-floor projection.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/general-wall-project.test.ts",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/derived-orthogonal-plan-faces.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/diagonal-room-split-mutation.json",
	},
	mutate: [
		// The raw derived face identity must remain durable across a split and
		// reopen; the new room must not get an enclosing grid fingerprint.
		"src/domain/general-wall-project.ts:2493-2495",
		"src/domain/general-wall-project.ts:2738-2742",
		// A canonical ring may be clockwise or counter-clockwise. The selected
		// Room's precise usable triangle detects a wrong inward normal.
		"src/domain/derived-orthogonal-plan-faces.ts:807-807",
		"src/domain/derived-orthogonal-plan-faces.ts:821-824",
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
