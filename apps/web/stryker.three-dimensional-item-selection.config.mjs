// Focused mutation evidence for the canonical floor-footprint projection used
// by the passive 3D selected-item frame. It runs in place; do not edit this
// module while Stryker is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/ui/three-dimensional-floor-interaction.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/three-dimensional-item-selection-mutation.json",
	},
	mutate: [
		"src/ui/three-dimensional-floor-interaction.ts:81-93",
		"src/ui/three-dimensional-floor-interaction.ts:195-213",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
