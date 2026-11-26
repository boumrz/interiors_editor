export default {
	commandRunner: {
		command: "rstest run --config rstest.mutation.config.mjs src/adapters/renderer/catalog-models.test.ts src/ui/telegram-greybox-catalog.test.tsx src/adapters/renderer/three-webgl2-room-renderer.test.ts src/adapters/renderer/webgl2-room-renderer.test.ts",
	},
	concurrency: 4,
	coverageAnalysis: "off",
	disableTypeChecks: false,
	// Rstest uses Rspack for transpilation. TypeScript 7 cannot rewrite tsconfig in a Stryker sandbox.
	ignorePatterns: ["tsconfig.json"],
	// Authored dimensions and finishes are covered by the table and card checks.
	mutator: { excludedMutations: ["ArrayDeclaration", "ObjectLiteral", "StringLiteral"] },
	jsonReporter: { fileName: "reports/mutation/catalog-models.json" },
	mutate: [
		"src/adapters/renderer/catalog-casework-models.ts",
		"src/adapters/renderer/catalog-fixture-models.ts",
		"src/adapters/renderer/catalog-model-parts.ts",
		"src/adapters/renderer/catalog-models.ts",
		"src/adapters/renderer/catalog-profile-geometry.ts",
		"src/adapters/renderer/catalog-seating-models.ts",
		"src/adapters/renderer/three-webgl2-room-renderer.ts:372-429",
		"src/adapters/renderer/webgl2-item-picking.ts:44-53",
		"src/adapters/renderer/webgl2-item-picking.ts:100-135",
		"src/adapters/renderer/webgl2-room-renderer.ts:1121-1165",
		"src/ui/telegram-greybox-catalog.tsx:350-361",
		"src/ui/telegram-greybox-catalog.tsx:375-431",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { high: 80, low: 70, break: 70 },
};
