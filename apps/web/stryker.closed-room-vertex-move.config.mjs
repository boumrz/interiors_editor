// Focused mutation evidence for the first touch-driven post-closure corner
// edit: its 45-degree projection, polygonal publish guard and collinear inset.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/ui/wall-vertex-move.test.tsx src/domain/general-wall-project.test.ts src/domain/derived-orthogonal-plan-faces.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/closed-room-vertex-move-mutation.json",
	},
	mutate: [
		"src/ui/wall-vertex-move.ts:91-112",
		"src/ui/wall-vertex-move.ts:126-135",
		"src/domain/general-wall-project.ts:1146-1146",
		"src/domain/general-wall-project.ts:1164-1165",
		"src/domain/derived-orthogonal-plan-faces.ts:975-977",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
