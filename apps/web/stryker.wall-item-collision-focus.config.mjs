export default {
	commandRunner: {
		command:
			"node scripts/check-runtime.mjs && ./node_modules/.bin/playwright test --config playwright.mutation.config.mjs --grep PLAN-E2E-05A",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/wall-item-collision-focus.json",
	},
	mutate: ["src/ui/AppShell.tsx:5004-5010"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};
