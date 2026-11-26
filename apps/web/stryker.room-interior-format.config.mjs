export default {
	commandRunner: {
		command: "rstest run --bail 1 --config rstest.mutation.config.mjs src/adapters/portable-backup/runtime-v1-interior.test.ts src/adapters/portable-backup/runtime-v1-transfer.test.ts src/domain/canonical-serialization.test.ts src/adapters/persistence/telegram-scope-store-public-boundary.test.ts",
	},
	concurrency: 4,
	coverageAnalysis: "off",
	disableTypeChecks: false,
	// Rstest transpiles with Rspack. The Stryker preprocessor cannot rewrite the TS 7 config.
	ignorePatterns: ["tsconfig.json"],
	mutator: { excludedMutations: ["ArrayDeclaration", "ObjectLiteral", "StringLiteral"] },
	jsonReporter: { fileName: "reports/mutation/room-interior-format.json" },
	mutate: [
		"src/adapters/portable-backup/runtime-portable-backup-codec.ts:69-71",
		"src/adapters/portable-backup/runtime-v1-wire.ts:287-304",
		"src/adapters/portable-backup/runtime-v1-wire.ts:385-416",
		"src/adapters/persistence/telegram-scope-store.ts:79-80",
		"src/adapters/persistence/telegram-scope-store.ts:240-246",
		"src/domain/canonical-serialization.ts:5-10",
		"src/domain/canonical-serialization.ts:23-24",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "progress", "json"],
	testRunner: "command",
	thresholds: { high: 80, low: 70, break: 70 },
};
