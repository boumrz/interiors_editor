// Focused mutation evidence for reflecting all wall-local durable addresses
// when the selected stable segment reverses its canonical direction.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"sleep 1 && touch src/domain/general-wall-project.ts",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts src/application/general-wall-project-mutations.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/reverse-general-wall-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:677-685",
		"src/domain/general-wall-project.ts:705-714",
		"src/domain/general-wall-project.ts:1312-1327",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
