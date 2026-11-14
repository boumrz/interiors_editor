// Focused mutation evidence for the revision boundary that clears a wall-split
// candidate after the current durable revision changes. It runs in place; do
// not edit AppShell while the command is running.
export default {
	commandRunner: {
		command: [
			"pnpm run check:runtime",
			"pnpm exec rstest run --config rstest.mutation.config.mjs src/ui/AppShell.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-7-2-cancel-gestures-mutation.json",
	},
	mutate: ["src/ui/AppShell.tsx:463-468"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
