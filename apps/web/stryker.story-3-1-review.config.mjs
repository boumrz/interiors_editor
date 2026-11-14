// Focused mutation evidence for Story 3.1's diagonal face safety and 3D
// exterior-normal contract. It runs in place; do not edit selected modules
// while this command is running.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/derive-plan-faces.test.ts src/domain/derived-orthogonal-plan-faces.test.ts src/domain/general-wall-project.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-3-1-review-mutation.json",
	},
	mutate: [
		// The public nested/disjoint-ring behavior detects an inverted final
		// containment decision. Intermediate guard and sign mutants are either
		// unreachable after a valid face walk or equivalent for a non-zero
		// winding number.
		"src/domain/derive-plan-faces.ts:574-574",
		// A diagonal shared Vertex must be removed from the durable fingerprint.
		"src/domain/derive-plan-faces.ts:639-642",
		// A clockwise canonical polygon must invert the outward normal.
		"src/domain/derived-orthogonal-plan-faces.ts:690-691",
		// Recovery must fail closed before allocating a Room for a collapsed
		// rectangular or 45-degree triangular usable polygon.
		"src/domain/general-wall-project.ts:393-394",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
