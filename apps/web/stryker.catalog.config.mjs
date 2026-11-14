export default {
	commandRunner: {
		command:
			"node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run src/adapters/catalog/catalog-media-validator.test.ts src/adapters/catalog/http-catalog-gateway.test.ts --config rstest.config.mjs",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/catalog-control-plane-mutation.json",
	},
	mutate: [
		"src/adapters/catalog/catalog-media-validator.ts",
		"src/adapters/catalog/http-catalog-gateway.ts",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};
