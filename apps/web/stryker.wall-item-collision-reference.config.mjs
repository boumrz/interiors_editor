export default {
	commandRunner: {
		command:
			"node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/general-wall-project.test.ts",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/wall-item-collision-reference.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:438-453",
		"src/domain/general-wall-project.ts:908-911",
		"src/domain/general-wall-project.ts:1468-1471",
		"src/domain/general-wall-project.ts:1553-1556",
		"src/domain/general-wall-project.ts:2067-2069",
		"src/domain/general-wall-project.ts:2468-2488",
		"src/domain/general-wall-project.ts:2490-2501",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};
