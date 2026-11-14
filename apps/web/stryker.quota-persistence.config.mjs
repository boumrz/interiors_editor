// Focused mutation evidence for quota classification and its recovery-facing UI.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			[
				"./node_modules/.bin/rstest run --config rstest.config.mjs",
				"src/adapters/persistence/durable-project-repository.test.ts",
				"src/ui/AppShell.test.tsx",
			].join(" "),
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/quota-persistence-mutation.json",
	},
	mutate: [
		"src/adapters/persistence/durable-project-repository.ts:110-134",
		"src/adapters/persistence/durable-project-repository.ts:324-337",
		"src/ui/AppShell.tsx:351-365",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 80,
		low: 70,
	},
};
