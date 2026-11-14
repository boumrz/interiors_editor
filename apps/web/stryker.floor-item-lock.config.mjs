// Focused mutation evidence for durable floor-item accidental-edit protection.
// Stryker runs in place; do not edit these modules while this command is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"sleep 1 && touch src/domain/parametric-item.ts src/application/set-parametric-floor-item-lock.ts src/domain/project-json-transfer.ts",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/parametric-item.test.ts src/application/set-parametric-floor-item-lock.test.ts src/domain/project-json-transfer.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/floor-item-lock-mutation.json",
	},
	mutate: [
		"src/domain/parametric-item.ts:289-289",
		"src/domain/parametric-item.ts:364-364",
		"src/domain/parametric-item.ts:415-415",
		"src/domain/parametric-item.ts:465-465",
		"src/domain/parametric-item.ts:505-505",
		"src/domain/parametric-item.ts:548-548",
		"src/domain/parametric-item.ts:568-602",
		"src/application/set-parametric-floor-item-lock.ts:51-85",
		"src/domain/project-json-transfer.ts:392-392",
		"src/domain/project-json-transfer.ts:402-402",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
