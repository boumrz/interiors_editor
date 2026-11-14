// Focused mutation evidence for the mandatory target name in irreversible delete confirmation.
// Stryker mutates sources in place, so no source edits may run concurrently.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/ui/project-deletion-copy.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/project-deletion-confirmation-mutation.json",
	},
	mutate: ["src/ui/project-deletion-copy.ts"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
