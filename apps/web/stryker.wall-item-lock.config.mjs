// Focused mutation evidence for the durable wall-item accidental-edit guard.
// Stryker runs in place; do not edit these modules while this command is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"sleep 1 && touch src/domain/parametric-wall-item.ts src/application/set-parametric-wall-item-lock.ts src/domain/project-json-transfer.ts",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/parametric-wall-item.test.ts src/application/set-parametric-wall-item-lock.test.ts src/domain/project-json-transfer.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/wall-item-lock-mutation.json",
	},
	mutate: [
		"src/domain/parametric-wall-item.ts:168-168",
		"src/domain/parametric-wall-item.ts:204-230",
		"src/domain/parametric-wall-item.ts:244-244",
		"src/domain/parametric-wall-item.ts:257-260",
		"src/application/set-parametric-wall-item-lock.ts:51-85",
		"src/domain/project-json-transfer.ts:436-436",
		"src/domain/project-json-transfer.ts:446-446",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
