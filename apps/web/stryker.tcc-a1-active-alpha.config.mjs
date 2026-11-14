// Focused mutation evidence for the active Alpha PPJ-A1 selector and TCC-A1
// authority boundary. It runs in place: do not edit selected source files
// while the single-worker run is active.
export default {
	commandRunner: {
		command:
			"pnpm run check:runtime && pnpm exec rstest run --config rstest.config.mjs src/domain/current-ppj-a1-legacy-classifier.test.ts src/domain/current-product-tcc-a1-corpus.test.ts src/domain/tcc-a1-corpus-runner.test.ts",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/tcc-a1-active-alpha-mutation.json",
	},
	mutate: [
		"src/domain/current-ppj-a1-legacy-classifier.ts:25-70",
		"src/domain/current-product-tcc-a1-corpus.ts:497-543",
		"src/domain/current-product-tcc-a1-corpus.ts:594-612",
		"src/domain/tcc-a1-corpus-runner.ts:588-700",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 90,
		low: 80,
	},
};
