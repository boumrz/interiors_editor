// Focused mutation evidence for resetting transient chrome when leaving the
// editor. It mutates in place; do not edit editor-chrome-state while active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/ui/editor-chrome-state.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/editor-header-menu-reset-mutation.json",
	},
	mutate: ["src/ui/editor-chrome-state.ts:5-9"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 80,
		low: 70,
	},
};
