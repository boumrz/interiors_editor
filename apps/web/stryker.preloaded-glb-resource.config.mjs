export default {
  thresholds: { break: 80, high: 80, low: 70 },
	commandRunner: {
		command:
			'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/ui/preloaded-glb-resource.test.tsx',
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/preloaded-glb-resource-mutation.json",
	},
	mutate: ["src/ui/preloaded-glb-resource.ts"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};
