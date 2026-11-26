export default {
	commandRunner: {
		command: "rstest run --bail 1 --config rstest.mutation.config.mjs src/application/create-parametric-floor-item.test.ts src/domain/interior-support.test.ts src/domain/room-layouts.test.ts src/adapters/renderer/rectangular-room-projection.test.ts",
	},
	concurrency: 4,
	coverageAnalysis: "off",
	disableTypeChecks: false,
	// Rstest transpiles with Rspack; the mutator does not rewrite the TypeScript 7 config.
	ignorePatterns: ["tsconfig.json"],
	mutator: { excludedMutations: ["ArrayDeclaration", "ObjectLiteral", "StringLiteral"] },
	jsonReporter: { fileName: "reports/mutation/room-interior-support.json" },
	mutate: [
		"src/application/create-parametric-floor-item.ts:56-57",
		"src/domain/interior-project.ts:229-272",
		"src/domain/interior-support.ts:149-157",
		"src/domain/interior-support.ts:193-195",
		"src/domain/interior-support.ts:218-279",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "progress", "json"],
	testRunner: "command",
	thresholds: { high: 80, low: 70, break: 70 },
};
