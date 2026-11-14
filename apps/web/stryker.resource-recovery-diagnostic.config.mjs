// Focused mutation evidence for the explicit recovery-only UI state.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/ui/AppShell.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/resource-recovery-diagnostic-mutation.json",
	},
	mutate: ["src/ui/AppShell.tsx:7414-7418", "src/ui/AppShell.tsx:7463-7468"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 80,
		low: 70,
	},
};
