// Focused mutation evidence for the Three.js adapter that turns a canonical
// projected item into local procedural furniture parts.
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
		fileName: "reports/mutation/three-greybox-item-mutation.json",
	},
	mutate: ["src/adapters/renderer/three-webgl2-room-renderer.ts:261-293"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
