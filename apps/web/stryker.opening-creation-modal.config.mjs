// Focused mutation evidence for the keyboard decision that enforces the real
// phone New Opening modal contract. Browser coverage verifies the mounted
// sheet; this fast deterministic harness proves every edge branch that keeps
// Tab and Escape inside it while publishing.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/ui/opening-creation-dialog.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/opening-creation-modal-mutation.json",
	},
	mutate: ["src/ui/opening-creation-dialog.ts"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
