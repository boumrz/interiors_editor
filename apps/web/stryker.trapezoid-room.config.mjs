// Focused mutation evidence for a convex 45-degree polygonal Room. It runs
// in place; do not edit the selected modules while this command is running.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/general-wall-project.test.ts src/domain/derived-orthogonal-plan-faces.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/trapezoid-room-mutation.json",
	},
	mutate: [
		// Admit a polygonal face, retain its durable fingerprint, and match it
		// again on a subsequent derived-plan read.
		"src/domain/general-wall-project.ts:1709-1713",
		"src/domain/general-wall-project.ts:1817-1820",
		"src/domain/general-wall-project.ts:2714-2716",
		"src/domain/general-wall-project.ts:2959-2962",
		// Pass the face through the renderer projection and calculate the
		// orientation-aware, precisely inset usable polygon.
		"src/domain/derived-orthogonal-plan-faces.ts:173-177",
		"src/domain/derived-orthogonal-plan-faces.ts:365-369",
		"src/domain/derived-orthogonal-plan-faces.ts:795-801",
		"src/domain/derived-orthogonal-plan-faces.ts:817-817",
		"src/domain/derived-orthogonal-plan-faces.ts:831-833",
		"src/domain/derived-orthogonal-plan-faces.ts:848-850",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
