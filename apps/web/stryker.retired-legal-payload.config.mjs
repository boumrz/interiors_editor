// Focused mutation evidence for removing retired legal asset payload while
// keeping the technical custom-GLB and Portable Backup integrity contract.
// It runs in place; do not edit the selected modules while it is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/custom-glb-asset.test.ts src/domain/project-json-transfer.test.ts src/application/export-portable-backup.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/retired-legal-payload-mutation.json",
	},
	mutate: [
		"src/domain/custom-glb-asset.ts:65-73",
		"src/domain/project-json-transfer.ts:470-484",
		"src/application/export-portable-backup.ts:161-170",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
