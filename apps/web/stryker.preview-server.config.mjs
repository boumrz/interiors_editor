// Run after the implementation owner freezes source edits: this scoped harness
// temporarily instruments only the preview server and restores it afterwards.
export default {
  thresholds: { break: 80, high: 80, low: 70 },
	commandRunner: {
		command: "node --test scripts/pwa-preview-server.test.mjs",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/preview-server-mutation.json",
	},
	mutate: [
		"scripts/serve-pwa-e2e.mjs:103-107",
		"scripts/serve-pwa-e2e.mjs:153-163",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};
