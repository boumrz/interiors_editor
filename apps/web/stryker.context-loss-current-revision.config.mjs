export default {
	commandRunner: {
		command:
			"node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/adapters/renderer/webgl2-room-renderer.test.ts",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/context-loss-current-revision.json",
	},
	mutate: ["src/adapters/renderer/webgl2-room-renderer.ts:138-140"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};
