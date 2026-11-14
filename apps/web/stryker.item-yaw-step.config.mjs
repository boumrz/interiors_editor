// Focused mutation evidence for the canonical floor-item orientation route.
// Stryker runs in place; do not edit the covered modules while it is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/parametric-item.test.ts src/application/rotate-parametric-floor-item.test.ts src/adapters/renderer/rectangular-room-projection.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/item-yaw-step-mutation.json",
	},
	mutate: [
		"src/domain/parametric-item.ts:390-393",
		"src/domain/parametric-item.ts:552-555",
		"src/domain/parametric-item.ts:1099-1104",
		"src/domain/parametric-item.ts:1187-1190",
		"src/adapters/renderer/rectangular-room-projection.ts:622-623",
		"src/adapters/renderer/rectangular-room-projection.ts:634-636",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
