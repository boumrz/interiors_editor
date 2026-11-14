// Focused mutation evidence for wall-item overlap warnings and their durable
// publication. It runs in place; do not edit either selected module while this
// command is running.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"sleep 1 && touch src/domain/parametric-wall-item.ts src/application/create-parametric-wall-item.ts src/application/move-parametric-wall-item.ts",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/parametric-wall-item.test.ts src/application/create-parametric-wall-item.test.ts src/application/move-parametric-wall-item.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/move-parametric-wall-item-mutation.json",
	},
	mutate: [
		"src/domain/parametric-wall-item.ts:163-208",
		"src/domain/parametric-wall-item.ts:244-263",
		"src/application/move-parametric-wall-item.ts:51-85",
		"src/application/create-parametric-wall-item.ts:61-108",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
