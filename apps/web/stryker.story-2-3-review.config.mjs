// Focused mutation evidence for the Story 2.3 review patches: origin-relative
// touch snapping, gesture eligibility, usable segment length and host safety.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/ui/wall-vertex-move.test.tsx src/domain/general-wall-project.test.ts src/domain/parametric-item.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-2-3-review-mutation.json",
	},
	mutate: [
		"src/ui/wall-vertex-move.ts:24-28",
		"src/ui/wall-vertex-move.ts:121-200",
		"src/domain/general-wall-project.ts:1223-1225",
		"src/domain/general-wall-project.ts:1239-1243",
		"src/domain/general-wall-project.ts:1295-1297",
		"src/domain/general-wall-project.ts:1325-1329",
		"src/domain/general-wall-project.ts:2036-2077",
		"src/domain/parametric-item.ts:881-911",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
