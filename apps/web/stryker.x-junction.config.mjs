// Focused mutation evidence for exact-X contact partitioning and wall-host
// reconciliation through the public AddWallSegment/Project mutation routes.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/add-wall-segment.test.ts src/domain/general-wall-project.test.ts src/domain/derive-plan-faces.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/x-junction-mutation.json",
	},
	mutate: [
		// Public exact-X decisions: new shared-vertex planning, contact
		// collection, shifted BigInt line arithmetic and integer-mm rejection.
		// Allocation/materialization guards whose inputs are constructed only by
		// this validated plan are deliberately outside this behavioral report.
		"src/domain/add-wall-segment.ts:130-145",
		"src/domain/add-wall-segment.ts:239-249",
		"src/domain/add-wall-segment.ts:710-739",
		"src/domain/add-wall-segment.ts:746-761",
		"src/domain/add-wall-segment.ts:789-794",
		// One exact successor must preserve the physical hosted interval through
		// the Project mutation; no silent deletion or ambiguous rehost is allowed.
		"src/domain/general-wall-project.ts:1646-1714",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
