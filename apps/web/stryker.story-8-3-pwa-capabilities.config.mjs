// Focused mutation evidence for capability-based install routing in Story 8.3.
// Stryker mutates in place; do not edit the selected module while it runs.
export default {
	commandRunner: {
		command: [
			"pnpm run check:runtime",
			"pnpm exec rstest run --config rstest.mutation.config.mjs src/ui/pwa-install-capabilities.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-8-3-pwa-capabilities-mutation.json",
	},
	mutate: ["src/ui/pwa-install-capabilities.ts"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
