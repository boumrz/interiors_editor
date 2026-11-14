// Focused mutation evidence for the disposable 3D camera's reference-aligned
// initial view and direct orbit/pan/pinch behaviour.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/ui/three-dimensional-viewport.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/three-dimensional-viewport-mutation.json",
	},
	mutate: ["src/ui/three-dimensional-viewport.ts"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
