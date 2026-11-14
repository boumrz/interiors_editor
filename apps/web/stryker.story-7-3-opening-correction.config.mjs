// Mutation evidence for Story 7.3's semantic Opening reference and correction copy.
// It runs in place; do not edit the selected source files while it is running.
export default {
	commandRunner: {
		command: [
			"pnpm run check:runtime",
			'pnpm exec rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts src/ui/AppShell.test.tsx --testNamePattern "(occupy a durable|wall mutation correction)"',
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-7-3-opening-correction-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:430-435",
		"src/ui/AppShell.tsx:802-823",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
