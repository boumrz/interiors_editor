// Focused mutation evidence for the single user-visible Portable Backup route.
// It mutates in place; do not edit the selected controller while it runs.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/app/project-controller.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/portable-backup-visible-route-mutation.json",
	},
	mutate: ["src/app/project-controller.ts:1423-1428"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 80,
		low: 70,
	},
};
