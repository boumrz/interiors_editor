// Focused mutation evidence for the shared, presentation-only 3D palette.
// Stryker mutates in place; do not edit the palette or its selected test while
// this command is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/adapters/renderer/three-webgl2-room-renderer.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/three-dimensional-room-palette-mutation.json",
	},
	mutate: ["src/adapters/renderer/three-dimensional-room-palette.ts"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
