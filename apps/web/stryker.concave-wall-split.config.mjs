// Focused mutation evidence for touch splitting one boundary Wall of an exact
// concave Room while retaining a continuous, equally inset simplified edge.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts src/domain/derived-orthogonal-plan-faces.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/concave-wall-split-mutation.json",
	},
	mutate: [
		"src/domain/derived-orthogonal-plan-faces.ts:720-727",
		"src/domain/derived-orthogonal-plan-faces.ts:809-810",
		"src/domain/derived-orthogonal-plan-faces.ts:818-820",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
